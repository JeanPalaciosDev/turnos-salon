import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { getWorker } from '../../../../src/workers/workerRepository';
import {
  type CommissionRuleDraft,
  type CommissionType,
  CommissionValidationError,
  observeWorkerOverrides,
  removeWorkerServiceCommission,
  setWorkerDefaultCommission,
  setWorkerServiceCommission,
} from '../../../../src/commissions/workerCommissionRepository';
import { observeServices } from '../../../../src/services/serviceRepository';
import type { ServiceModel, WorkerServiceCommissionModel } from '../../../../src/database/models';
import { useObservable } from '../../../../src/lib/useObservable';
import { getBusinessBaseCurrency } from '../../../../src/services/serviceRepository';
import { formatMoney } from '../../../../src/lib/money';
import { AppScreen } from '../../../../src/components';
import { Button, Chip } from '../../../../src/components/atoms';
import {
  FieldWithSuffix,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormLabel,
} from '../../../../src/components/forms';
import { SectionHeading } from '../../../../src/components/detail';
import { createStyles } from '../../../../src/theme';

/** Texto de una regla de comisión para mostrarla de un vistazo. */
function ruleLabel(type: CommissionType, value: number, currency: string): string {
  return type === 'percentage' ? `${value}%` : `${formatMoney(value, currency)} por servicio`;
}

/**
 * Comisión de un trabajador: la regla por defecto y, por cada servicio, la
 * posibilidad de fijar una excepción. Se ven todos los servicios activos con su
 * comisión efectiva, así el dueño entiende de un vistazo cuánto cobra el
 * trabajador en cada uno sin tener que abrir pantalla por pantalla.
 * Solo para la cuenta owner.
 */
export default function WorkerCommissionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const styles = useStyles();

  const [workerName, setWorkerName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('ARS');
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const [defaultType, setDefaultType] = useState<CommissionType>('percentage');
  const [defaultValue, setDefaultValue] = useState('0');

  /** Servicio con el editor de excepción abierto. */
  const [openServiceId, setOpenServiceId] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<CommissionType>('percentage');
  const [draftValue, setDraftValue] = useState('0');

  const services = useObservable(
    () => (profile ? observeServices(profile) : undefined),
    [profile?.id],
    [] as ServiceModel[],
  );
  const overrides = useObservable(
    () => (profile && id ? observeWorkerOverrides(profile, id) : undefined),
    [profile?.id, id],
    [] as WorkerServiceCommissionModel[],
  );

  const overrideByService = useMemo(() => {
    const map = new Map<string, WorkerServiceCommissionModel>();
    for (const row of overrides) map.set(row.serviceId, row);
    return map;
  }, [overrides]);

  useEffect(() => {
    if (!profile || !id) return;
    let alive = true;
    void Promise.all([getWorker(profile, id), getBusinessBaseCurrency(profile)])
      .then(([worker, currency]) => {
        if (!alive) return;
        setWorkerName(worker.name);
        setBaseCurrency(currency);
        setDefaultType(worker.commissionType);
        setDefaultValue(String(worker.commissionValue));
        setLoaded(true);
      })
      .catch((e) =>
        setErrors([e instanceof Error ? e.message : 'No se pudo cargar el trabajador.']),
      );
    return () => {
      alive = false;
    };
  }, [profile, id]);

  if (profile && profile.role !== 'owner') {
    return <Redirect href="/(app)/worker" />;
  }

  const run = async (action: () => Promise<unknown>) => {
    if (!profile || !id || busy) return;
    setBusy(true);
    setErrors([]);
    try {
      await action();
      await syncNow();
    } catch (e) {
      if (e instanceof CommissionValidationError) setErrors(e.messages);
      else setErrors([e instanceof Error ? e.message : 'No se pudo guardar la comisión.']);
    } finally {
      setBusy(false);
    }
  };

  const draftFor = (type: CommissionType, value: string): CommissionRuleDraft => ({
    commissionType: type,
    commissionValue: Number.parseInt(value, 10),
    commissionCurrency: type === 'fixed_per_service' ? baseCurrency : undefined,
  });

  const saveDefault = () =>
    run(() => setWorkerDefaultCommission(profile!, id!, draftFor(defaultType, defaultValue)));

  const saveOverride = (serviceId: string) =>
    run(async () => {
      await setWorkerServiceCommission(profile!, id!, serviceId, draftFor(draftType, draftValue));
      setOpenServiceId(null);
    });

  const clearOverride = (overrideId: string) =>
    run(async () => {
      await removeWorkerServiceCommission(profile!, overrideId);
      setOpenServiceId(null);
    });

  const openEditor = (service: ServiceModel) => {
    const existing = overrideByService.get(service.id);
    setDraftType(existing?.commissionType ?? defaultType);
    setDraftValue(String(existing?.commissionValue ?? (Number.parseInt(defaultValue, 10) || 0)));
    setOpenServiceId(service.id);
  };

  const activeServices = services.filter((s) => s.isActive);

  return (
    <AppScreen header={false}>
      <FormHeaderRow
        title={workerName ? `Comisión de ${workerName}` : 'Comisión'}
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Comisión por defecto" />
          <View style={styles.typeRow}>
            <Chip
              label="Porcentaje"
              selected={defaultType === 'percentage'}
              onPress={() => setDefaultType('percentage')}
            />
            <Chip
              label="Monto fijo"
              selected={defaultType === 'fixed_per_service'}
              onPress={() => setDefaultType('fixed_per_service')}
            />
          </View>
          <FieldWithSuffix
            value={defaultValue}
            onChangeText={setDefaultValue}
            suffix={defaultType === 'percentage' ? '%' : baseCurrency}
            placeholder="0"
          />
          <Text style={styles.hint}>
            {defaultType === 'percentage'
              ? 'Porcentaje de lo recaudado en cada turno.'
              : 'Monto fijo por cada servicio que preste, sin importar lo recaudado.'}
          </Text>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar comisión por defecto'}
            onPress={() => void saveDefault()}
            disabled={busy || !loaded}
          />
        </FormGroup>

        <SectionHeading title="Por servicio" />
        <Text style={styles.sectionHint}>
          Toca un servicio para que cobre una comisión distinta a la de por defecto.
        </Text>

        {activeServices.length === 0 ? (
          <Text style={styles.empty}>
            No hay servicios activos. Crea uno para poder fijar comisiones por servicio.
          </Text>
        ) : (
          activeServices.map((service) => {
            const override = overrideByService.get(service.id);
            const isOpen = openServiceId === service.id;
            const effectiveType = override?.commissionType ?? defaultType;
            const effectiveValue =
              override?.commissionValue ?? (Number.parseInt(defaultValue, 10) || 0);
            const effectiveCurrency = override?.commissionCurrency ?? baseCurrency;

            return (
              <View key={service.id} style={styles.serviceBlock}>
                <Pressable
                  onPress={() => (isOpen ? setOpenServiceId(null) : openEditor(service))}
                  style={({ pressed }) => [styles.serviceRow, pressed && styles.serviceRowPressed]}
                  accessibilityRole="button"
                >
                  <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{service.name}</Text>
                    <Text style={styles.serviceMeta}>
                      {ruleLabel(effectiveType, effectiveValue, effectiveCurrency)}
                      {override ? '  ·  excepción' : '  ·  por defecto'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>{isOpen ? '⌃' : '›'}</Text>
                </Pressable>

                {isOpen ? (
                  <View style={styles.editor}>
                    <View style={styles.typeRow}>
                      <Chip
                        label="Porcentaje"
                        selected={draftType === 'percentage'}
                        onPress={() => setDraftType('percentage')}
                      />
                      <Chip
                        label="Monto fijo"
                        selected={draftType === 'fixed_per_service'}
                        onPress={() => setDraftType('fixed_per_service')}
                      />
                    </View>
                    <FieldWithSuffix
                      value={draftValue}
                      onChangeText={setDraftValue}
                      suffix={draftType === 'percentage' ? '%' : baseCurrency}
                      placeholder="0"
                    />
                    <Button
                      variant="primary"
                      label={busy ? 'Guardando…' : 'Guardar excepción'}
                      onPress={() => void saveOverride(service.id)}
                      disabled={busy}
                    />
                    {override ? (
                      <Button
                        variant="danger-ghost"
                        label="Usar la comisión por defecto"
                        onPress={() => void clearOverride(override.id)}
                        disabled={busy}
                      />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, paddingBottom: t.spacing.xxl, gap: t.spacing.sm },
  typeRow: { flexDirection: 'row', gap: t.spacing.sm },
  hint: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  sectionHint: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
    paddingBottom: t.spacing.sm,
  },
  empty: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
    paddingVertical: t.spacing.lg,
  },
  serviceBlock: {
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.card,
    backgroundColor: t.palette.bgSurface,
    overflow: 'hidden',
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.md,
  },
  serviceRowPressed: { backgroundColor: t.palette.bgSunken },
  serviceInfo: { flex: 1, gap: t.spacing.xs },
  serviceName: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  serviceMeta: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  chevron: { fontSize: 18, lineHeight: 22, color: t.palette.textMuted },
  editor: {
    gap: t.spacing.sm,
    padding: t.spacing.md,
    borderTopWidth: 1,
    borderTopColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSunken,
  },
}));
