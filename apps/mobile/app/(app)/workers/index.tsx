import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { canManageWorkers } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { WorkerModel } from '../../../src/database/models';
import { observeWorkers } from '../../../src/workers/workerRepository';
import { colors, radius, spacing, typography } from '../../../src/theme';

function commissionSummary(worker: WorkerModel): string {
  if (worker.commissionType === 'percentage') {
    return `Comisión ${worker.commissionValue}%`;
  }

  const currency = worker.commissionCurrency ?? '';
  return `Comisión fija ${worker.commissionValue} ${currency}`.trim();
}

export default function WorkersScreen() {
  const { profile, status, syncErrorMessage, syncStatus } = useAuth();
  const [workers, setWorkers] = useState<WorkerModel[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = Boolean(profile && canManageWorkers(profile));

  useEffect(() => {
    if (!profile || !canManage) {
      return;
    }

    const subscription = observeWorkers(profile).subscribe({
      next: (items) => {
        setWorkers(items);
        setIsLoading(false);
      },
      error: (error: unknown) => {
        setErrorMessage(
          error instanceof Error ? error.message : 'No se pudieron cargar los trabajadores.'
        );
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [canManage, profile]);

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Trabajadores</Text>
          <Text style={styles.subtitle}>Cargá al equipo y definí cómo cobra su comisión.</Text>
        </View>
        <Pressable onPress={() => router.push('/workers/new')} style={styles.addButton}>
          <Text style={styles.addButtonText}>Nuevo</Text>
        </Pressable>
      </View>

      {syncStatus === 'syncing' ? <Text style={styles.syncing}>Sincronizando cambios…</Text> : null}
      {syncStatus === 'error' && syncErrorMessage ? (
        <Text style={styles.syncError}>Guardado localmente. {syncErrorMessage}</Text>
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandPrimary} />
          <Text style={styles.subtitle}>Cargando trabajadores…</Text>
        </View>
      ) : errorMessage ? (
        <Text style={styles.syncError}>{errorMessage}</Text>
      ) : workers.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavía no cargaste trabajadores</Text>
          <Text style={styles.emptyText}>
            Sumá al primero para poder asignarle turnos y calcular sus comisiones.
          </Text>
          <Pressable onPress={() => router.push('/workers/new')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Cargar trabajador</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {workers.map((worker) => (
            <Pressable
              key={worker.id}
              onPress={() => router.push(`/workers/${worker.id}`)}
              style={({ pressed }) => [styles.workerCard, pressed && styles.pressed]}
            >
              <View style={styles.workerMain}>
                <Text style={styles.workerName}>{worker.name}</Text>
                <Text style={styles.workerDetails}>{commissionSummary(worker)}</Text>
              </View>
              {!worker.isActive ? (
                <View style={styles.inactiveBadge}>
                  <Text style={styles.inactiveBadgeText}>Inactivo</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    ...typography.display,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 21,
  },
  addButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  addButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  syncing: {
    color: colors.brandPrimary,
    ...typography.body,
    fontWeight: '600',
  },
  syncError: {
    color: colors.status.cancelled.border,
    ...typography.body,
  },
  loading: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.xl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    ...typography.h2,
  },
  emptyText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  list: {
    gap: spacing.md,
  },
  workerCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  workerMain: {
    flex: 1,
    gap: spacing.xs,
  },
  workerName: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  workerDetails: {
    color: colors.textSecondary,
    ...typography.body,
  },
  inactiveBadge: {
    borderRadius: radius.pill,
    backgroundColor: colors.status.done.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inactiveBadgeText: {
    color: colors.status.done.border,
    ...typography.small,
  },
  pressed: {
    opacity: 0.7,
  },
});
