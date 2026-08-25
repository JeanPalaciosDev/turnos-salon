import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { canManageServices } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ServiceModel } from '../../../src/database/models';
import { observeServices } from '../../../src/services/serviceRepository';

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
          <ActivityIndicator color="#1d4ed8" />
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
    gap: 16,
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 21,
  },
  addButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  syncing: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
  },
  syncError: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  loading: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 48,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 20,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '800',
  },
  emptyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  list: {
    gap: 10,
  },
  serviceCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 16,
  },
  serviceMain: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '800',
  },
  serviceDetails: {
    color: '#475569',
    fontSize: 14,
  },
  active: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
  },
  inactive: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
});
