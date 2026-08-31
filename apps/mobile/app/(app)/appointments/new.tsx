import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { canCreateAppointment } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { AppointmentForm, type OptionItem } from '../../../src/appointments/AppointmentForm';
import {
  type AppointmentDraft,
  createAppointment,
} from '../../../src/appointments/appointmentRepository';
import { database } from '../../../src/database';
import { ClientModel, ServiceModel, WorkerModel } from '../../../src/database/models';
import { colors, spacing, typography } from '../../../src/theme';

function todayIso(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export default function NewAppointmentScreen() {
  const { profile, status, syncNow } = useAuth();
  const [services, setServices] = useState<OptionItem[]>([]);
  const [workers, setWorkers] = useState<OptionItem[]>([]);
  const [clients, setClients] = useState<OptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = Boolean(profile && canCreateAppointment(profile));

  useEffect(() => {
    if (!profile || !canManage) {
      return;
    }

    let isMounted = true;

    void (async () => {
      const [serviceRecords, workerRecords, clientRecords] = await Promise.all([
        database.get<ServiceModel>('services').query().fetch(),
        database.get<WorkerModel>('workers').query().fetch(),
        database.get<ClientModel>('clients').query().fetch(),
      ]);

      if (!isMounted) {
        return;
      }

      setServices(
        serviceRecords
          .filter((s) => s.businessId === profile.business_id && !s.isDeleted && s.isActive)
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((s) => ({ id: s.id, label: s.name, hint: `${s.durationMinutes} min` }))
      );
      setWorkers(
        workerRecords
          .filter((w) => w.businessId === profile.business_id && !w.isDeleted && w.isActive)
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
    })();

    return () => {
      isMounted = false;
    };
  }, [canManage, profile]);

  const initialValue = useMemo<AppointmentDraft>(
    () => ({
      date: todayIso(),
      startTime: '09:00',
      serviceId: services[0]?.id ?? '',
      workerId: workers[0]?.id ?? '',
      clientId: clients[0]?.id ?? '',
    }),
    [services, workers, clients]
  );

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Preparando formulario…</Text>
      </View>
    );
  }

  const handleSubmit = async (draft: AppointmentDraft) => {
    await createAppointment(profile, draft);
    await syncNow();
    router.replace('/appointments');
  };

  return (
    <AppointmentForm
      initialValue={initialValue}
      services={services}
      workers={workers}
      clients={clients}
      onSubmit={handleSubmit}
      submitLabel="Crear cita"
    />
  );
}

const styles = StyleSheet.create({
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
});
