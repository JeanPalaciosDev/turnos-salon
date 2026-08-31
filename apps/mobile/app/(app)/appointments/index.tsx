import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  AppointmentOfflineError,
  completeOwnAppointment,
  observeAppointmentsForDay,
} from '../../../src/appointments/appointmentRepository';
import { statusColors, statusIcon, statusLabel } from '../../../src/appointments/status';
import { database } from '../../../src/database';
import { AppointmentModel, ClientModel, ServiceModel, WorkerModel } from '../../../src/database/models';
import { colors, radius, spacing, staffColors, tabularNumbers, typography } from '../../../src/theme';

// Ventana horaria de la grilla y densidad (px por minuto → alto proporcional a duración).
const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 21 * 60;
const PIXELS_PER_MINUTE = 1.1;
const HOUR_STEP_MINUTES = 60;
const COLUMN_WIDTH = 180;
const TIME_GUTTER_WIDTH = 56;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(iso: string, delta: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function formatHeaderDate(iso: string): string {
  const date = parseIsoDate(iso);
  const formatted = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToLabel(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

const GRID_HEIGHT = (DAY_END_MINUTES - DAY_START_MINUTES) * PIXELS_PER_MINUTE;

function useNowMinutes(): number {
  const [nowMinutes, setNowMinutes] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return nowMinutes;
}

export default function AgendaScreen() {
  const { profile, status, syncErrorMessage, syncNow, syncStatus } = useAuth();
  const { width } = useWindowDimensions();
  const [selectedDate, setSelectedDate] = useState(() => toIsoDate(new Date()));
  const [appointments, setAppointments] = useState<AppointmentModel[]>([]);
  const [workers, setWorkers] = useState<WorkerModel[]>([]);
  const [services, setServices] = useState<Map<string, ServiceModel>>(new Map());
  const [clients, setClients] = useState<Map<string, ClientModel>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // En pantallas angostas la grilla multi-columna degrada a una sola columna.
  const [focusedWorkerId, setFocusedWorkerId] = useState<string | null>(null);

  const nowMinutes = useNowMinutes();
  const isNarrow = width < 640;

  useEffect(() => {
    if (!profile) {
      return;
    }

    setIsLoading(true);
    const subscription = observeAppointmentsForDay(profile, selectedDate).subscribe({
      next: (items) => {
        setAppointments(items);
        setIsLoading(false);
      },
      error: (error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudieron cargar los turnos.'
        );
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [profile, selectedDate]);

  // Los datos auxiliares (workers/services/clients) se leen una vez por render de
  // pantalla; la agenda depende de que ya estén sincronizados localmente.
  useEffect(() => {
    if (!profile) {
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const [workerRecords, serviceRecords, clientRecords] = await Promise.all([
          database.get<WorkerModel>('workers').query().fetch(),
          database.get<ServiceModel>('services').query().fetch(),
          database.get<ClientModel>('clients').query().fetch(),
        ]);

        if (!isMounted) {
          return;
        }

        const activeWorkers = workerRecords
          .filter((worker) => worker.businessId === profile.business_id && !worker.isDeleted)
          .filter((worker) =>
            profile.role === 'worker' ? worker.id === profile.worker_id : true
          )
          .sort((a, b) => a.name.localeCompare(b.name));

        setWorkers(activeWorkers);
        setServices(new Map(serviceRecords.map((service) => [service.id, service])));
        setClients(new Map(clientRecords.map((client) => [client.id, client])));

        if (activeWorkers.length > 0) {
          setFocusedWorkerId((current) => current ?? activeWorkers[0].id);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error ? error.message : 'No se pudieron cargar los datos de la agenda.'
          );
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [profile, selectedDate]);

  const appointmentsByWorker = useMemo(() => {
    const map = new Map<string, AppointmentModel[]>();
    for (const appointment of appointments) {
      const list = map.get(appointment.workerId) ?? [];
      list.push(appointment);
      map.set(appointment.workerId, list);
    }
    return map;
  }, [appointments]);

  const hourLines = useMemo(() => {
    const lines: number[] = [];
    for (let m = DAY_START_MINUTES; m <= DAY_END_MINUTES; m += HOUR_STEP_MINUTES) {
      lines.push(m);
    }
    return lines;
  }, []);

  if (status !== 'ready' || !profile) {
    return <Redirect href="/home" />;
  }

  const isOwner = profile.role === 'owner';

  // Worker: confirmar y marcar completado vía RPC dedicada (online). El owner
  // usa el flujo de detalle (tap → /appointments/[id]) y no pasa por acá.
  const handleCompleteAppointment = (appointment: AppointmentModel) => {
    Alert.alert(
      'Marcar como completada',
      '¿Confirmás que este turno ya se realizó?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Completar',
          style: 'default',
          onPress: () => {
            void (async () => {
              try {
                await completeOwnAppointment(profile, appointment.id);
                // La agenda es reactiva (observe); igual pedimos pull/push para
                // que server-wins confirme la transición cuanto antes.
                await syncNow();
              } catch (error) {
                const message =
                  error instanceof AppointmentOfflineError
                    ? error.message
                    : error instanceof Error
                      ? error.message
                      : 'No se pudo completar el turno.';
                Alert.alert('No se pudo completar', message);
              }
            })();
          },
        },
      ]
    );
  };

  const visibleWorkers =
    isNarrow && focusedWorkerId
      ? workers.filter((worker) => worker.id === focusedWorkerId)
      : workers;

  const showNowLine =
    selectedDate === toIsoDate(new Date()) &&
    nowMinutes >= DAY_START_MINUTES &&
    nowMinutes <= DAY_END_MINUTES;
  const nowOffset = (nowMinutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.dateNav}>
          <Pressable
            onPress={() => setSelectedDate((current) => addDays(current, -1))}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>‹</Text>
          </Pressable>
          <View style={styles.dateLabelWrap}>
            <Text style={styles.dateLabel}>{formatHeaderDate(selectedDate)}</Text>
            <Pressable onPress={() => setSelectedDate(toIsoDate(new Date()))}>
              <Text style={styles.todayLink}>Hoy</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setSelectedDate((current) => addDays(current, 1))}
            style={styles.navButton}
          >
            <Text style={styles.navButtonText}>›</Text>
          </Pressable>
        </View>
        {isOwner ? (
          <Pressable
            onPress={() => router.push('/appointments/new')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addButtonText}>+ Nueva cita</Text>
          </Pressable>
        ) : null}
      </View>

      {syncStatus === 'syncing' ? <Text style={styles.syncing}>Sincronizando cambios…</Text> : null}
      {syncStatus === 'error' && syncErrorMessage ? (
        <Text style={styles.syncError}>Guardado localmente. {syncErrorMessage}</Text>
      ) : null}
      {errorMessage ? <Text style={styles.syncError}>{errorMessage}</Text> : null}

      {isNarrow && workers.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workerChips}
        >
          {workers.map((worker, index) => {
            const isSelected = worker.id === focusedWorkerId;
            return (
              <Pressable
                key={worker.id}
                onPress={() => setFocusedWorkerId(worker.id)}
                style={[styles.workerChip, isSelected && styles.workerChipActive]}
              >
                <View
                  style={[
                    styles.workerDot,
                    { backgroundColor: staffColors[index % staffColors.length] },
                  ]}
                />
                <Text style={[styles.workerChipText, isSelected && styles.workerChipTextActive]}>
                  {worker.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandPrimary} />
          <Text style={styles.helper}>Cargando agenda…</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavía no hay profesionales</Text>
          <Text style={styles.emptyText}>
            {isOwner
              ? 'Cargá al menos un profesional para armar la grilla de la agenda.'
              : 'Tu agenda aparecerá acá cuando tengas turnos asignados.'}
          </Text>
          {isOwner ? (
            <Pressable onPress={() => router.push('/workers')} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Gestionar profesionales</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <ScrollView style={styles.gridVertical} contentContainerStyle={styles.gridVerticalContent}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.grid}>
              {/* Columna de horas */}
              <View style={[styles.timeGutter, { height: GRID_HEIGHT }]}>
                {hourLines.map((minutes) => (
                  <View
                    key={minutes}
                    style={[
                      styles.hourLabelWrap,
                      { top: (minutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE },
                    ]}
                  >
                    <Text style={styles.hourLabel}>{minutesToLabel(minutes)}</Text>
                  </View>
                ))}
              </View>

              {/* Columnas por profesional */}
              <View>
                <View style={styles.columnsHeader}>
                  {visibleWorkers.map((worker, index) => (
                    <View key={worker.id} style={styles.columnHeaderCell}>
                      <View
                        style={[
                          styles.workerDot,
                          {
                            backgroundColor:
                              staffColors[
                                workers.indexOf(worker) % staffColors.length
                              ] ?? staffColors[index % staffColors.length],
                          },
                        ]}
                      />
                      <Text style={styles.columnHeaderText} numberOfLines={1}>
                        {worker.name}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={[styles.columnsBody, { height: GRID_HEIGHT }]}>
                  {/* Líneas horarias de fondo */}
                  {hourLines.map((minutes) => (
                    <View
                      key={minutes}
                      style={[
                        styles.hourGridLine,
                        { top: (minutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE },
                      ]}
                    />
                  ))}

                  {visibleWorkers.map((worker) => {
                    const workerAppointments = appointmentsByWorker.get(worker.id) ?? [];
                    return (
                      <View key={worker.id} style={styles.column}>
                        {workerAppointments.map((appointment) => (
                          <AppointmentCard
                            key={appointment.id}
                            appointment={appointment}
                            serviceName={services.get(appointment.serviceId)?.name}
                            clientName={clients.get(appointment.clientId)?.name}
                            actionable={!isOwner && appointment.status === 'scheduled'}
                            onPress={
                              isOwner
                                ? () => router.push(`/appointments/${appointment.id}`)
                                : appointment.status === 'scheduled'
                                  ? () => handleCompleteAppointment(appointment)
                                  : undefined
                            }
                          />
                        ))}
                      </View>
                    );
                  })}

                  {/* Línea de "ahora" (elemento de firma) cruzando la grilla. */}
                  {showNowLine ? (
                    <View pointerEvents="none" style={[styles.nowLine, { top: nowOffset }]}>
                      <View style={styles.nowDot} />
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

type AppointmentCardProps = {
  appointment: AppointmentModel;
  serviceName?: string;
  clientName?: string;
  onPress?: () => void;
  actionable?: boolean;
};

function AppointmentCard({
  appointment,
  serviceName,
  clientName,
  onPress,
  actionable = false,
}: AppointmentCardProps) {
  const startMinutes = timeToMinutes(appointment.startTime);
  const endMinutes = timeToMinutes(appointment.endTime);
  const top = (startMinutes - DAY_START_MINUTES) * PIXELS_PER_MINUTE;
  const height = Math.max((endMinutes - startMinutes) * PIXELS_PER_MINUTE, 34);
  const palette = statusColors(appointment.status);
  const isCancelled = appointment.status === 'cancelled';

  const content = (
    <View
      style={[
        styles.card,
        {
          top,
          height,
          borderLeftColor: palette.border,
          backgroundColor: palette.bg,
          opacity: isCancelled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.cardTime, tabularNumbers]} numberOfLines={1}>
        {statusIcon(appointment.status)} {appointment.startTime}–{appointment.endTime}
      </Text>
      <Text
        style={[styles.cardClient, isCancelled && styles.cancelledText]}
        numberOfLines={1}
      >
        {clientName ?? 'Cliente'}
      </Text>
      {height > 52 ? (
        <Text style={styles.cardService} numberOfLines={1}>
          {serviceName ?? 'Servicio'}
        </Text>
      ) : null}
      {actionable && height > 72 ? (
        <Text style={[styles.cardAction, { color: colors.brandPrimary }]} numberOfLines={1}>
          ✓ Tocá para completar
        </Text>
      ) : height > 72 ? (
        <Text style={[styles.cardStatus, { color: palette.border }]} numberOfLines={1}>
          {statusLabel(appointment.status)}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.bgBase,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 1,
  },
  navButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
  },
  navButtonText: {
    color: colors.brandPrimary,
    fontSize: 22,
    lineHeight: 24,
  },
  dateLabelWrap: {
    alignItems: 'center',
    gap: 2,
  },
  dateLabel: {
    color: colors.textPrimary,
    ...typography.h2,
    fontSize: 17,
  },
  todayLink: {
    color: colors.brandPrimary,
    ...typography.micro,
  },
  addButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 14,
  },
  syncing: {
    color: colors.brandPrimary,
    ...typography.body,
    fontWeight: '600',
  },
  syncError: {
    color: colors.status.cancelled.border,
    ...typography.body,
  },
  helper: {
    color: colors.textSecondary,
    ...typography.body,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.h2,
  },
  emptyText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  workerChips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  workerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  workerChipActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSoft,
  },
  workerChipText: {
    color: colors.textSecondary,
    ...typography.small,
  },
  workerChipTextActive: {
    color: colors.brandPrimary,
  },
  workerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  gridVertical: {
    flex: 1,
  },
  gridVerticalContent: {
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
  },
  timeGutter: {
    width: TIME_GUTTER_WIDTH,
    // Alinea con el alto del header de columnas.
    marginTop: 44,
  },
  hourLabelWrap: {
    position: 'absolute',
    right: spacing.sm,
  },
  hourLabel: {
    color: colors.textSecondary,
    ...typography.micro,
    ...tabularNumbers,
  },
  columnsHeader: {
    flexDirection: 'row',
    height: 44,
  },
  columnHeaderCell: {
    width: COLUMN_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderSubtle,
    paddingHorizontal: spacing.sm,
  },
  columnHeaderText: {
    flex: 1,
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
  columnsBody: {
    flexDirection: 'row',
    position: 'relative',
  },
  column: {
    width: COLUMN_WIDTH,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderSubtle,
    position: 'relative',
  },
  hourGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  card: {
    position: 'absolute',
    left: spacing.xs,
    right: spacing.xs,
    gap: 2,
    borderLeftWidth: 3,
    borderRadius: radius.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    overflow: 'hidden',
  },
  cardTime: {
    color: colors.textSecondary,
    ...typography.small,
  },
  cardClient: {
    color: colors.textPrimary,
    ...typography.h3,
    fontSize: 14,
  },
  cardService: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 12,
  },
  cardStatus: {
    ...typography.micro,
  },
  cardAction: {
    ...typography.micro,
    fontWeight: '600',
  },
  cancelledText: {
    textDecorationLine: 'line-through',
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.brandPrimary,
  },
  nowDot: {
    position: 'absolute',
    left: -4,
    top: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
  },
  pressed: {
    opacity: 0.7,
  },
});
