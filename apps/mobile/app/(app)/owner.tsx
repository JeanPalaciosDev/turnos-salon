import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { observeAppointmentsForDay } from '../../src/appointments/appointmentRepository';
import type { AppointmentModel } from '../../src/database/models';
import { useObservable } from '../../src/lib/useObservable';
import { AppScreen } from '../../src/components/AppScreen';
import { HomeHeader, SectionHeading } from '../../src/components/detail';
import { StatCard } from '../../src/components/lists';
import { createStyles } from '../../src/theme';

function formatTodayDate(): string {
  const raw = new Date().toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function todayIso(): string {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function greetingName(email: string): string {
  const local = email.split('@')[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function nextTurnTime(appointments: AppointmentModel[]): string {
  const now = new Date();
  const nowHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const future = appointments
    .filter(a => a.status !== 'cancelled' && a.startTime > nowHM)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  return future.length > 0 ? future[0].startTime : '—';
}

const QUICK_LINKS = [
  { label: 'Agenda', icon: '📅', href: '/(app)/agenda' as const },
  { label: 'Servicios', icon: '✂️', href: '/(app)/services' as const },
  { label: 'Trabajadores', icon: '💇', href: '/(app)/workers' as const },
  { label: 'Clientes', icon: '🧑', href: '/(app)/clients' as const },
] satisfies { label: string; icon: string; href: string }[];

/** Pantalla 4 — Principal Owner (§8.2). */
export default function OwnerHomeScreen() {
  const { profile } = useAuth();
  const styles = useStyles();

  const today = useMemo(() => todayIso(), []);
  const appointments = useObservable(
    () => (profile ? observeAppointmentsForDay(profile, today) : undefined),
    [profile?.id, today],
    [] as AppointmentModel[],
  );

  const active = appointments.filter(a => a.status !== 'cancelled');
  const name = profile ? greetingName(profile.email) : '';
  const greet = name ? 'Hola, ' + name : 'Hola';

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <HomeHeader greeting={greet} subgreeting={formatTodayDate()} />

        <View style={styles.stats}>
          <View style={styles.statCol}>
            <StatCard
              label="Turnos hoy"
              value={String(active.length)}
              onPress={() => router.push('/(app)/agenda')}
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Próximo turno"
              value={nextTurnTime(appointments)}
              onPress={() => router.push('/(app)/agenda')}
            />
          </View>
        </View>

        <SectionHeading title="Accesos" />
        <QuickLinks />
      </ScrollView>
    </AppScreen>
  );
}

function QuickLinks() {
  const styles = useLinkStyles();

  return (
    <View style={styles.list}>
      {QUICK_LINKS.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href as never)}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          accessibilityRole="button"
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>{item.label}</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  scroll: { paddingBottom: t.spacing.xxl },
  stats: {
    flexDirection: 'row',
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.sm,
  },
  statCol: { flex: 1 },
}));

const useLinkStyles = createStyles((t) => ({
  list: {
    borderTopWidth: 1,
    borderTopColor: t.palette.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSurface,
  },
  rowPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
    width: 24,
    textAlign: 'center',
  },
  label: {
    flex: 1,
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 22,
    color: t.palette.textMuted,
  },
}));
