import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import {
  AppointmentValidationError,
  AppointmentOverlapError,
  getAppointment,
  setAppointmentStatus,
  updateAppointmentWithServices,
} from '../../../../src/appointments/appointmentRepository';
import { getAppointmentServices } from '../../../../src/appointments/appointmentServiceRepository';
import { getClient } from '../../../../src/clients/clientRepository';
import { getWorker } from '../../../../src/workers/workerRepository';
import { getService } from '../../../../src/services/serviceRepository';
import {
  resetAppointmentDraft,
  useAppointmentDraft,
} from '../../../../src/appointments/appointmentDraft';
import type { AppointmentStatus } from '@turnos/core';
import { AppScreen } from '../../../../src/components/AppScreen';
import { Button, Chip } from '../../../../src/components/atoms';
import {
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormLabel,
  FormSelect,
} from '../../../../src/components/forms';
import { SectionHeading } from '../../../../src/components/detail';
import { createStyles } from '../../../../src/theme';

const STATUS_OPTIONS: { key: AppointmentStatus; label: string }[] = [
  { key: 'created', label: 'Creado' },
  { key: 'pending', label: 'Pendiente' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'done', label: 'Finalizado' },
  { key: 'no_show', label: 'Ausente' },
  { key: 'cancelled', label: 'Cancelado' },
];

/** Pantalla 14 — Turno, Editar (§8.8). Datos reales + chip-group de estado. */
export default function AppointmentEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const draft = useAppointmentDraft();
  const [status, setStatus] = useState<AppointmentStatus>('created');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  // Precargar el borrador con el turno actual (una sola vez).
  useEffect(() => {
    if (!profile || !id || loaded) return;
    let alive = true;
    void (async () => {
      try {
        const appt = await getAppointment(profile, id);
        const bridge = await getAppointmentServices(profile, id);
        const serviceNames = await Promise.all(
          bridge.map(async (row) => {
            try {
              return (await getService(profile, row.serviceId)).name;
            } catch {
              return 'Servicio';
            }
          }),
        );
        let clientName = appt.clientId;
        try {
          clientName = (await getClient(profile, appt.clientId)).name;
        } catch {
          /* */
        }
        let workerName = 'Sin asignar';
        if (appt.workerId) {
          try {
            workerName = (await getWorker(profile, appt.workerId)).name;
          } catch {
            /* */
          }
        }
        if (!alive) return;
        resetAppointmentDraft({
          clientId: appt.clientId,
          clientName,
          workerId: appt.workerId,
          workerName,
          serviceIds: bridge.map((r) => r.serviceId),
          serviceNames,
          date: appt.date,
          time: appt.startTime,
        });
        setStatus(appt.status);
        setLoaded(true);
      } catch (e) {
        if (alive) setErrors([e instanceof Error ? e.message : 'No se pudo cargar el turno.']);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile, id, loaded]);

  const onSave = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setErrors([]);
    try {
      await updateAppointmentWithServices(profile, id, {
        date: draft.date ?? '',
        startTime: draft.time ?? '',
        serviceIds: draft.serviceIds,
        workerId: draft.workerId,
        clientId: draft.clientId ?? '',
      });
      await setAppointmentStatus(profile, id, status);
      await syncNow();
      router.back();
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
      <FormHeaderRow title="Editar turno" onBack={() => router.back()} />
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

        <SectionHeading title="Estado" />
        <View style={styles.chips}>
          {STATUS_OPTIONS.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              selected={s.key === status}
              onPress={() => setStatus(s.key)}
            />
          ))}
        </View>

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar cambios'}
            onPress={() => void onSave()}
            disabled={busy || !loaded}
          />
          <Button
            variant="danger-ghost"
            label="Eliminar turno"
            onPress={() => router.push(`/(app)/appointments/${id}/delete`)}
          />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
  },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
