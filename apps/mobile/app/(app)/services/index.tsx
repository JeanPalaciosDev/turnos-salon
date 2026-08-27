import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { canManageServices } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ServiceModel } from '../../../src/database/models';
import { observeServices } from '../../../src/services/serviceRepository';
import { colors, radius, spacing, typography } from '../../../src/theme';

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(amount / 100);
  } catch {
    return `${currency} ${(amount / 100).toFixed(2)}`;
  }
}

export default function ServicesScreen() {
  const { profile, status, syncErrorMessage, syncStatus } = useAuth();
  const [services, setServices] = useState<ServiceModel[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = Boolean(profile && canManageServices(profile));

  useEffect(() => {
    if (!profile || !canManage) {
      return;
    }

    const subscription = observeServices(profile).subscribe({
      next: (items) => {
        setServices(items);
        setIsLoading(false);
      },
      error: (error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los servicios.');
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [canManage, profile]);

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Servicios</Text>
          <Text style={styles.subtitle}>Administrá precios, duración y disponibilidad.</Text>
        </View>
        <Pressable onPress={() => router.push('/services/new')} style={styles.addButton}>
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
          <Text style={styles.subtitle}>Cargando servicios…</Text>
        </View>
      ) : errorMessage ? (
        <Text style={styles.syncError}>{errorMessage}</Text>
      ) : services.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavía no hay servicios</Text>
          <Text style={styles.emptyText}>Creá el primero para empezar a armar la agenda del salón.</Text>
          <Pressable onPress={() => router.push('/services/new')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Crear servicio</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {services.map((service) => (
            <Pressable
              key={service.id}
              onPress={() => router.push(`/services/${service.id}`)}
              style={({ pressed }) => [styles.serviceCard, pressed && styles.pressed]}
            >
              <View style={styles.serviceMain}>
                <Text style={styles.serviceName}>{service.name}</Text>
                <Text style={styles.serviceDetails}>
                  {service.durationMinutes} min · {formatPrice(service.defaultPriceAmount, service.defaultPriceCurrency)}
                </Text>
              </View>
              <Text style={service.isActive ? styles.active : styles.inactive}>
                {service.isActive ? 'Activo' : 'Inactivo'}
              </Text>
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
  serviceCard: {
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
  serviceMain: {
    flex: 1,
    gap: spacing.xs,
  },
  serviceName: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  serviceDetails: {
    color: colors.textSecondary,
    ...typography.body,
  },
  active: {
    color: colors.status.confirmed.border,
    ...typography.small,
    fontWeight: '600',
  },
  inactive: {
    color: colors.textMuted,
    ...typography.small,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
