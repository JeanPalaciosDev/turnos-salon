import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { canViewPayments, sumCollectedInBaseCurrency } from '@turnos/core';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { getAppointment } from '../../../../src/appointments/appointmentRepository';
import { getAppointmentServices } from '../../../../src/appointments/appointmentServiceRepository';
import { observePaymentsForAppointment, voidPayment } from '../../../../src/appointments/paymentRepository';
import { getClient } from '../../../../src/clients/clientRepository';
import { getWorker } from '../../../../src/workers/workerRepository';
import { getService, getBusinessBaseCurrency } from '../../../../src/services/serviceRepository';
import type { PaymentModel } from '../../../../src/database/models';
import { useObservable } from '../../../../src/lib/useObservable';
import { formatMoney } from '../../../../src/lib/money';
import { AppScreen } from '../../../../src/components/AppScreen';
import { Button, IconButton, ServiceTag } from '../../../../src/components/atoms';
import { DetailRow, DetailStatusBanner, SectionHeading, type AppointmentStatus } from '../../../../src/components/detail';
import { createStyles } from '../../../../src/theme';

const METHOD_LABEL: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
};

const STATUS_LABEL: Record<string, { status: AppointmentStatus; label: string }> = {
  created: { status: 'creado', label: 'Creado' },
  pending: { status: 'pendiente', label: 'Pendiente' },
  in_progress: { status: 'curso', label: 'En curso' },
  done: { status: 'finalizado', label: 'Finalizado' },
  no_show: { status: 'ausente', label: 'Ausente' },
  cancelled: { status: 'cancelado', label: 'Cancelado' },
};

interface DetailData {
  statusKey: string;
  clientName: string;
  workerName: string;
  serviceNames: string[];
  dateTime: string;
}

/** Pantalla 12 — Turno, Detalle (§8.8). Conectada a datos reales. */
export default function AppointmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const [data, setData] = useState<DetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseCurrency, setBaseCurrency] = useState('ARS');
  const styles = useStyles();

  const canSeePayments = profile ? canViewPayments(profile) : false;

  const payments = useObservable(
    () => (profile && id && canSeePayments ? observePaymentsForAppointment(profile, id) : undefined),
    [profile?.id, id, canSeePayments],
    [] as PaymentModel[],
  );

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void getBusinessBaseCurrency(profile).then((c) => {
      if (active) setBaseCurrency(c);
    });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const collected = sumCollectedInBaseCurrency(
    payments.map((p) => ({
      amount: p.amount,
      currency: p.currency,
      exchange_rate: p.exchangeRate,
      is_deleted: p.isDeleted,
    })),
    baseCurrency,
  );

  useEffect(() => {
    if (!profile || !id) return;
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
          /* nombre no disponible */
        }
        let workerName = 'Sin asignar';
        if (appt.workerId) {
          try {
            workerName = (await getWorker(profile, appt.workerId)).name;
          } catch {
            workerName = 'Sin asignar';
          }
        }
        if (!alive) return;
        setData({
          statusKey: appt.status,
          clientName,
          workerName,
          serviceNames: serviceNames.length > 0 ? serviceNames : ['Sin servicios'],
          dateTime: `${appt.date} · ${appt.startTime}`,
        });
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'No se pudo cargar el turno.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile, id]);

  const banner = data ? STATUS_LABEL[data.statusKey] ?? STATUS_LABEL.created : STATUS_LABEL.created;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <DetailStatusBanner status={banner.status} label={banner.label} />

        <DetailRow label="Cliente" value={data?.clientName ?? '—'} />
        <DetailRow label="Trabajador" value={data?.workerName ?? '—'} />
        <DetailRow label="Servicios">
          <View style={styles.tags}>
            {(data?.serviceNames ?? []).map((name) => (
              <ServiceTag key={name} label={name} />
            ))}
          </View>
        </DetailRow>
        <DetailRow label="Fecha y hora" value={data?.dateTime ?? '—'} />

        {canSeePayments ? (
          <>
            <SectionHeading
              title="Cobros"
              action={{ label: 'Registrar', onPress: () => router.push(`/(app)/appointments/${id}/payment`) }}
            />
            {payments.length > 0 ? (
              <>
                {payments.map((p) => (
                  <View key={p.id} style={styles.paymentRow}>
                    <View style={styles.paymentInfo}>
                      <Text style={styles.paymentAmount}>{formatMoney(p.amount, p.currency)}</Text>
                      <Text style={styles.paymentMeta}>{METHOD_LABEL[p.method] ?? p.method}</Text>
                    </View>
                    <IconButton
                      icon="✕"
                      variant="danger"
                      onPress={() => {
                        if (profile) void voidPayment(profile, p.id);
                      }}
                    />
                  </View>
                ))}
                <DetailRow label="Recaudado" value={formatMoney(collected, baseCurrency)} />
              </>
            ) : (
              <Text style={styles.paymentsEmpty}>
                Sin cobros registrados. Un turno puede cerrarse sin cobros.
              </Text>
            )}
          </>
        ) : null}

        <View style={styles.actions}>
          <Button
            variant="primary"
            label="Editar turno"
            onPress={() => router.push(`/(app)/appointments/${id}/edit`)}
          />
          <Button
            variant="danger-ghost"
            label="Cancelar turno"
            onPress={() => router.push(`/(app)/appointments/${id}/delete`)}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  scroll: { paddingBottom: t.spacing.xxl },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  error: {
    color: t.palette.statusCancelledBorder,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.md,
    fontSize: t.typeScale.small.fontSize,
    fontFamily: t.typeScale.small.fontFamily,
  },
  actions: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
  },
  paymentInfo: { gap: t.spacing.xs },
  paymentAmount: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  paymentMeta: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  paymentsEmpty: {
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
}));
