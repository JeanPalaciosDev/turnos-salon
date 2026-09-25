import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  AppointmentValidationError,
  AppointmentOverlapError,
  createAppointmentWithServices,
} from '../../../src/appointments/appointmentRepository';
import {
  resetAppointmentDraft,
  useAppointmentDraft,
} from '../../../src/appointments/appointmentDraft';
import { AppScreen } from '../../../src/components/AppScreen';
import { Button } from '../../../src/components/atoms';
import {
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormLabel,
  FormSelect,
} from '../../../src/components/forms';
import { createStyles } from '../../../src/theme';

/** Pantalla 13 — Turno, Nuevo (§8.7). Los campos abren modales que llenan el borrador. */
export default function AppointmentNewScreen() {
  const { profile, syncNow } = useAuth();
  const draft = useAppointmentDraft();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const styles = useStyles();

  // Al abrir un turno nuevo, empezar con el borrador limpio (una sola vez).
  useEffect(() => {
    if (!initialized) {
      resetAppointmentDraft();
      setInitialized(true);
    }
  }, [initialized]);

  const onSave = async () => {
    if (!profile) return;
    setBusy(true);
    setErrors([]);
    try {
      await createAppointmentWithServices(profile, {
        date: draft.date ?? '',
        startTime: draft.time ?? '',
        serviceIds: draft.serviceIds,
        workerId: draft.workerId,
        clientId: draft.clientId ?? '',
      });
      await syncNow();
      resetAppointmentDraft();
      router.replace('/(app)/agenda');
    } catch (e) {
      if (e instanceof AppointmentValidationError) setErrors(e.messages);
      else if (e instanceof AppointmentOverlapError) setErrors([e.message]);
      else setErrors([e instanceof Error ? e.message : 'No se pudo guardar el turno.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Nuevo turno" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Cliente" required />
          <FormSelect
            value={draft.clientName ?? ''}
            placeholder="Elegir cliente"
            onPress={() => router.push('/(app)/appointments/pick-client')}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Trabajador" />
          <FormSelect
            value={draft.workerName ?? ''}
            placeholder="Sin asignar"
            onPress={() => router.push('/(app)/appointments/pick-worker')}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Servicios" required />
          <FormSelect
            value={draft.serviceNames.join(', ')}
            placeholder="Elegir servicios"
            onPress={() => router.push('/(app)/appointments/pick-services')}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Fecha" required />
          <FormSelect
            value={draft.date ?? ''}
            placeholder="Elegir fecha"
            onPress={() => router.push('/(app)/appointments/pick-date')}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Hora" required />
          <FormSelect
            value={draft.time ?? ''}
            placeholder="Elegir hora"
            onPress={() => router.push('/(app)/appointments/pick-time')}
          />
        </FormGroup>

        <FormHint text="El turno se crea con estado Creado. No se permiten fechas anteriores a hoy." />
        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar turno'}
            onPress={() => void onSave()}
            disabled={busy || !profile}
          />
          <Button variant="secondary" label="Cancelar" onPress={() => router.back()} />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
