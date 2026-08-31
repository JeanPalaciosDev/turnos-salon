import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { canCancelAppointment, canEditAppointment } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { AppointmentForm, type OptionItem } from '../../../src/appointments/AppointmentForm';
import {
  type AppointmentDraft,
  cancelAppointment,
  getAppointment,
  updateAppointment,
} from '../../../src/appointments/appointmentRepository';
import { database } from '../../../src/database';
import { AppointmentModel, ClientModel, ServiceModel, WorkerModel } from '../../../src/database/models';
import { colors, radius, spacing, typography } from '../../../src/theme';

function toDomain(record: AppointmentModel) {
  return {
    id: record.id,
    business_id: record.businessId,
    date: record.date,
    start_time: record.startTime,
    end_time: record.endTime,
    status: record.status,
    service_id: record.serviceId,
    worker_id: record.workerId,
    client_id: record.clientId,
    notes: record.notes,
    updated_at: record.updatedAt,
    sync_version: record.syncVersion,
    is_deleted: record.isDeleted,
  };
}

export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, status, syncNow } = useAuth();
  const [appointment, setAppointment] = useState<AppointmentModel | null>(null);
  const [services, setServices] = useState<OptionItem[]>([]);
  const [workers, setWorkers] = useState<OptionItem[]>([]);
  const [clients, setClients] = useState<OptionItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  const appointmentId = Array.isArray(id) ? id[0] : id;
  const isOwner = profile?.role === 'owner';

  useEffect(() => {
    if (!profile || !isOwner || !appointmentId) {
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const record = await getAppointment(profile, appointmentId);
        const [serviceRecords, workerRecords, clientRecords] = await Promise.all([
          database.get<ServiceModel>('services').query().fetch(),
          database.get<WorkerModel>('workers').query().fetch(),
          database.get<ClientModel>('clients').query().fetch(),
        ]);

        if (!isMounted) {
          return;
        }

        setAppointment(record);
        setServices(
          serviceRecords
            .filter((s) => s.businessId === profile.business_id && !s.isDeleted)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({ id: s.id, label: s.name, hint: `${s.durationMinutes} min` }))
        );
        setWorkers(
          workerRecords
            .filter((w) => w.businessId === profile.business_id && !w.isDeleted)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((w) => ({ id: w.id, label: w.name }))
        );
        setClients(
          clientRecords
            .filter((c) => c.businessId === profile.business_id && !c.isDeleted)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((c) => ({ id: c.id, label: c.name }))
        );
        setIsLoading(false);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el turno.');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isOwner, profile, appointmentId]);

  const initialValue = useMemo<AppointmentDraft | null>(() => {
    if (!appointment) {
      return null;
    }

    return {
      date: appointment.date,
      startTime: appointment.startTime,
      serviceId: appointment.serviceId,
      workerId: appointment.workerId,
      clientId: appointment.clientId,
      notes: appointment.notes,
    };
  }, [appointment]);

  if (status !== 'ready' || !profile || !isOwner || !appointmentId) {
    return <Redirect href="/home" />;
  }

  const canEdit = appointment ? canEditAppointment(profile, toDomain(appointment)) : false;
  const canCancel = appointment ? canCancelAppointment(profile, toDomain(appointment)) : false;
  const isCancelled = appointment?.status === 'cancelled';

  const handleSubmit = async (draft: AppointmentDraft) => {
    await updateAppointment(profile, appointmentId, draft);
    await syncNow();
    router.replace('/appointments');
  };

  const handleCancel = async () => {
    setIsCancelling(true);

    try {
      await cancelAppointment(profile, appointmentId);
      await syncNow();
      router.replace('/appointments');
    } catch (error) {
      Alert.alert(
        'No se pudo cancelar el turno',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert(
      'Cancelar turno',
      'El turno quedará marcado como cancelado y liberará el horario. Se conserva en la agenda tachado.',
      [
        { text: 'Volver', style: 'cancel' },
        { text: 'Cancelar turno', style: 'destructive', onPress: () => void handleCancel() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Cargando turno…</Text>
      </View>
    );
  }

  if (errorMessage || !appointment || !initialValue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{errorMessage ?? 'El turno no existe.'}</Text>
        <Pressable onPress={() => router.replace('/appointments')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver a la agenda</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {canEdit && !isCancelled ? (
        <AppointmentForm
          initialValue={initialValue}
          services={services}
          workers={workers}
          clients={clients}
          onSubmit={handleSubmit}
          submitLabel="Guardar cambios"
        />
      ) : (
        <View style={styles.readonlyCard}>
          <Text style={styles.readonlyText}>
            {isCancelled
              ? 'Este turno está cancelado. No se puede editar.'
              : 'No tenés permisos para editar este turno.'}
          </Text>
        </View>
      )}

      {canCancel && !isCancelled ? (
        <View style={styles.actionArea}>
          <Pressable
            disabled={isCancelling}
            onPress={confirmCancel}
            style={({ pressed }) => [
              styles.cancelButton,
              (pressed || isCancelling) && styles.buttonPressed,
            ]}
          >
            {isCancelling ? (
              <ActivityIndicator color={colors.status.cancelled.border} />
            ) : (
              <Text style={styles.cancelText}>Cancelar turno</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgBase,
  },
  loadingText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  errorText: {
    color: colors.status.cancelled.border,
    ...typography.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  backButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  readonlyCard: {
    margin: spacing.xl,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  readonlyText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
  },
  actionArea: {
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  cancelButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  cancelText: {
    color: colors.status.cancelled.border,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
