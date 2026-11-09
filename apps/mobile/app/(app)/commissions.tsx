import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import {
  type CommissionPeriodView,
  getCommissionsForPeriod,
} from '../../src/commissions/commissionRepository';
import { useBusinessTimezone, useCommissionsEnabled } from '../../src/lib/businessConfig';
import { endOfMonthIso, monthLabel, startOfMonthIso } from '../../src/lib/clock';
import { formatMoney } from '../../src/lib/money';
import { AppScreen } from '../../src/components/AppScreen';
import { HomeHeader, SectionHeading } from '../../src/components/detail';
import { StatCard } from '../../src/components/lists';
import { createStyles } from '../../src/theme';

/**
 * Comisiones y dashboard del owner (tarea 15). Visible solo cuando el negocio
 * usa comisiones (commissions_enabled) y para la cuenta owner. El período por
 * defecto es el mes actual en la zona del negocio. Montos en moneda base.
 */
export default function CommissionsScreen() {
  const { profile } = useAuth();
  const timeZone = useBusinessTimezone(profile);
  const commissionsEnabled = useCommissionsEnabled(profile);
  const styles = useStyles();

  const [data, setData] = useState<CommissionPeriodView | null>(null);
  const [loading, setLoading] = useState(true);

  const startIso = useMemo(() => startOfMonthIso(timeZone), [timeZone]);
  const endIso = useMemo(() => endOfMonthIso(timeZone), [timeZone]);
  const period = useMemo(() => monthLabel(timeZone), [timeZone]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!profile || !commissionsEnabled) {
        setData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      getCommissionsForPeriod(profile, startIso, endIso)
        .then((result) => {
          if (active) {
            setData(result);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setData(null);
            setLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [profile?.id, commissionsEnabled, startIso, endIso]),
  );

  if (profile && profile.role !== 'owner') {
    return <Redirect href="/(app)/worker" />;
  }

  if (profile && !commissionsEnabled) {
    return <Redirect href="/(app)/owner" />;
  }

  const base = data?.base_currency ?? 'ARS';

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <HomeHeader greeting="Comisiones" subgreeting={period} />

        <View style={styles.stats}>
          <View style={styles.statCol}>
            <StatCard
              label="Recaudado"
              value={formatMoney(data?.total_collected_in_base ?? 0, base)}
            />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Comisiones"
              value={formatMoney(data?.total_commissions ?? 0, base)}
            />
          </View>
        </View>
        <View style={styles.stats}>
          <View style={styles.statCol}>
            <StatCard label="Neto" value={formatMoney(data?.net_in_base ?? 0, base)} />
          </View>
          <View style={styles.statCol}>
            <StatCard
              label="Turnos finalizados"
              value={String(data?.completed_appointments ?? 0)}
            />
          </View>
        </View>

        <SectionHeading title="Por trabajador" />

        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Cargando comisiones...</Text>
          </View>
        ) : !data || data.per_worker.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No hay comisiones para este período. Aparecen cuando hay turnos
              finalizados con un profesional asignado.
            </Text>
          </View>
        ) : (
          data.per_worker.map((w) => (
            <View key={w.worker_id} style={styles.workerRow}>
              <View style={styles.workerInfo}>
                <Text style={styles.workerName}>{w.worker_name}</Text>
                <Text style={styles.workerMeta}>
                  {w.commission_type === 'percentage'
                    ? `${w.commission_value}% de lo recaudado`
                    : `Monto fijo por servicio`}
                  {'  ·  '}
                  {w.lines.length} {w.lines.length === 1 ? 'turno' : 'turnos'}
                </Text>
              </View>
              <Text style={styles.workerAmount}>
                {formatMoney(w.total_commission, base)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </AppScreen>
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
  empty: { padding: t.spacing.xxl, alignItems: 'center' },
  emptyText: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
    textAlign: 'center',
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSurface,
  },
  workerInfo: { flex: 1, gap: t.spacing.xs },
  workerName: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  workerMeta: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  workerAmount: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
}));
