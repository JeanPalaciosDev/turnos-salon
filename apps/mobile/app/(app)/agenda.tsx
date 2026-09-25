import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { observeAppointmentsForDay } from '../../src/appointments/appointmentRepository';
import { observeClients } from '../../src/clients/clientRepository';
import { observeWorkers } from '../../src/workers/workerRepository';
import { observeServices } from '../../src/services/serviceRepository';
import type {
  AppointmentModel,
  ClientModel,
  ServiceModel,
  WorkerModel,
} from '../../src/database/models';
import { useObservable } from '../../src/lib/useObservable';
import { AppScreen } from '../../src/components/AppScreen';
import { FabButton } from '../../src/components/atoms';
import {
  DaySelectorRow,
  WeekEmptyState,
  WeekList,
  WeekNav,
  type AppointmentCardStatus,
} from '../../src/components/agenda';
import { createStyles } from '../../src/theme';

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const FULL_DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Domingo de la semana que contiene `d`. */
function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}

/** Mapea el status de dominio (6 estados) al del AppointmentCard (color). */
function toCardStatus(status: string): AppointmentCardStatus {
  switch (status) {
    case 'created':
    case 'in_progress':
      return 'active';
    case 'pending':
      return 'pending';
    case 'done':
      return 'done';
    case 'no_show':
      return 'noshow';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'confirmed';
  }
}

/** Pantalla 11 — Agenda semanal (§8.4). Conectada a datos reales. */
export default function AgendaScreen() {
  const { profile } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(new Date().getDay());
  const styles = useStyles();

  const weekStart = useMemo(() => {
    const base = startOfWeek(new Date());
    base.setDate(base.getDate() + weekOffset * 7);
    return base;
  }, [weekOffset]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { date: d, dayName: DAY_NAMES[i], dayNumber: d.getDate() };
      }),
    [weekStart],
  );

  const selectedDate = iso(days[selectedIndex]?.date ?? weekStart);
  const first = days[0].date;
  const last = days[6].date;
  const title = `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;

  const todayIso = iso(new Date());
  const todayIndex = days.findIndex((d) => iso(d.date) === todayIso);

  const appointments = useObservable(
    () => (profile ? observeAppointmentsForDay(profile, selectedDate) : undefined),
    [profile?.id, selectedDate],
    [] as AppointmentModel[],
  );

  const clients = useObservable(
    () => (profile ? observeClients(profile) : undefined),
    [profile?.id],
    [] as ClientModel[],
  );
  const workers = useObservable(
    () => (profile ? observeWorkers(profile) : undefined),
    [profile?.id],
    [] as WorkerModel[],
  );
  const services = useObservable(
    () => (profile ? observeServices(profile) : undefined),
    [profile?.id],
    [] as ServiceModel[],
  );

  const clientNames = useMemo(
    () => new Map(clients.map((c) => [c.id, c.name])),
    [clients],
  );
  const workerNames = useMemo(
    () => new Map(workers.map((w) => [w.id, w.name])),
    [workers],
  );
  const serviceNames = useMemo(
    () => new Map(services.map((s) => [s.id, s.name])),
    [services],
  );

  const items = appointments.map((a) => ({
    id: a.id,
    time: a.startTime,
    clientName: clientNames.get(a.clientId) ?? 'Cliente',
    serviceName: a.serviceId ? serviceNames.get(a.serviceId) ?? '' : '',
    workerName: a.workerId ? workerNames.get(a.workerId) ?? 'Sin asignar' : 'Sin asignar',
    status: toCardStatus(a.status),
  }));

  const selDate = days[selectedIndex]?.date ?? new Date();
  const isToday = iso(selDate) === todayIso;
  const dayLabel = FULL_DAY_NAMES[selDate.getDay()] + ' ' + selDate.getDate() + (isToday ? ' · hoy' : '');

  return (
    <AppScreen fab={<FabButton onPress={() => router.push('/(app)/appointments/new')} />}>
      <View style={styles.container}>
        <WeekNav
          title={title}
          onPrev={() => setWeekOffset((o) => o - 1)}
          onNext={() => setWeekOffset((o) => o + 1)}
          onCalendar={() => router.push('/(app)/appointments/pick-date')}
        />
        <DaySelectorRow
          days={days.map((d) => ({ dayName: d.dayName, dayNumber: d.dayNumber }))}
          selectedIndex={selectedIndex}
          todayIndex={todayIndex >= 0 ? todayIndex : undefined}
          onSelect={setSelectedIndex}
        />
        <Text style={styles.dayLabel}>{dayLabel}</Text>
        {items.length > 0 ? (
          <View style={styles.list}>
            <WeekList
              items={items}
              onItemPress={(id) => router.push(`/(app)/appointments/${id}`)}
            />
          </View>
        ) : (
          <WeekEmptyState />
        )}
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1 },
  dayLabel: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.sm,
  },
  list: { flex: 1, paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.sm },
}));
