import {useMemo, useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {router} from 'expo-router';

import {useAuth} from '../../src/auth/AuthProvider';
import {
  AppointmentOfflineError,
  completeOwnAppointment,
  observeAppointmentsForDay,
} from '../../src/appointments/appointmentRepository';
// Client names resolved from appointment data (worker has no client list access);
import type {AppointmentModel} from '../../src/database';
import {useObservable} from '../../src/lib/useObservable';
import {AppScreen} from '../../src/components';
import {Button} from '../../src/components/atoms';
import {HomeHeader} from '../../src/components/detail';
import {AppointmentCard} from '../../src/components/agenda';
import {createStyles} from '../../src/theme';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pantalla 5 — Principal Worker (§8.3). Muestra el próximo turno propio real. */
export default function WorkerHomeScreen() {
  const {profile, syncNow} = useAuth();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const styles = useStyles();

  const appointments = useObservable(
    () => (profile ? observeAppointmentsForDay(profile, todayIso()) : undefined),
    [profile?.id],
    [] as AppointmentModel[],
  );

  const clientNames = useMemo(() => new Map<string, string>(), []);
  // Worker sees "Cliente" as fallback - no access to client list;

  // Próximo turno "pendiente" del día (status created).
  const next = appointments.find((a) => a.status === 'created') ?? appointments[0];

  const onComplete = async () => {
    if (!profile || !next) return;
    setBusy(true);
    setMsg(null);
    try {
      await completeOwnAppointment(profile, next.id);
      await syncNow();
      setMsg('Turno marcado como completado.');
    } catch (e) {
      if (e instanceof AppointmentOfflineError) setMsg(e.message);
      else setMsg(e instanceof Error ? e.message : 'No se pudo completar el turno.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen>
      <View style={styles.container}>
        <HomeHeader greeting="¡Hola!" subgreeting="Tu próximo turno"/>

        {next ? (
          <>
            <View style={styles.card}>
              <Pressable onPress={() => router.push(`/(app)/appointments/${next.id}`)}>
                <AppointmentCard
                  time={next.startTime}
                  clientName={clientNames.get(next.clientId) ?? 'Cliente'}
                  serviceName=""
                  status="active"
                />
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Button
                variant="secondary"
                label={busy ? 'Marcando…' : 'Marcar completado'}
                onPress={() => void onComplete()}
                disabled={busy}
              />
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tenés turnos para hoy.</Text>
          </View>
        )}
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  container: {flex: 1},
  card: {paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.md},
  footer: {paddingHorizontal: t.spacing.xl, paddingTop: t.spacing.lg, gap: t.spacing.sm},
  msg: {
    fontSize: t.typeScale.small.fontSize,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  empty: {padding: t.spacing.xxl, alignItems: 'center'},
  emptyText: {
    fontSize: t.typeScale.body.fontSize,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
    textAlign: 'center',
  },
}));
