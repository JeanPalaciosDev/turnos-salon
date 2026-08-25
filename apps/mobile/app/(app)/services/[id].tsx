import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { canManageServices } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ServiceModel } from '../../../src/database/models';
import { ServiceForm } from '../../../src/services/ServiceForm';
import {
  getService,
  setServiceActive,
  type ServiceDraft,
  updateService,
} from '../../../src/services/serviceRepository';

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, status, syncNow } = useAuth();
  const [service, setService] = useState<ServiceModel | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const serviceId = Array.isArray(id) ? id[0] : id;
  const canManage = Boolean(profile && canManageServices(profile));

  useEffect(() => {
    if (!profile || !canManage || !serviceId) {
      return;
    }

    let isMounted = true;

    void getService(profile, serviceId)
      .then((value) => {
        if (isMounted) {
          setService(value);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el servicio.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManage, profile, serviceId]);

  const initialValue = useMemo<ServiceDraft | null>(() => {
    if (!service) {
      return null;
    }

    return {
      name: service.name,
      durationMinutes: service.durationMinutes,
      defaultPriceAmount: service.defaultPriceAmount,
      defaultPriceCurrency: service.defaultPriceCurrency,
    };
  }, [service]);

  if (status !== 'ready' || !profile || !canManage || !serviceId) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: ServiceDraft) => {
    await updateService(profile, serviceId, draft);
    await syncNow();
    router.replace('/services');
  };

  const handleToggleActive = async () => {
    if (!service) {
      return;
    }

    setIsToggling(true);

    try {
      const updated = await setServiceActive(profile, service.id, !service.isActive);
      setService(updated);
      await syncNow();
    } catch (error) {
      Alert.alert(
        'No se pudo actualizar el servicio',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsToggling(false);
    }
  };

  const confirmToggleActive = () => {
    if (!service) {
      return;
    }

    const action = service.isActive ? 'desactivar' : 'reactivar';
    const description = service.isActive
      ? 'El servicio quedará fuera de los nuevos turnos, pero conservará el historial existente.'
      : 'El servicio volverá a estar disponible para nuevos turnos.';

    Alert.alert(`${action.charAt(0).toUpperCase()}${action.slice(1)} servicio`, description, [
      { text: 'Cancelar', style: 'cancel' },
      { text: action.charAt(0).toUpperCase() + action.slice(1), onPress: () => void handleToggleActive() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#1d4ed8" />
        <Text style={styles.loadingText}>Cargando servicio…</Text>
      </View>
    );
  }

  if (errorMessage || !service || !initialValue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{errorMessage ?? 'El servicio no existe.'}</Text>
        <Pressable onPress={() => router.replace('/services')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver a servicios</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ServiceForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar cambios" />
      <View style={styles.actionArea}>
        <Pressable
          disabled={isToggling}
          onPress={confirmToggleActive}
          style={({ pressed }) => [
            service.isActive ? styles.deactivateButton : styles.activateButton,
            (pressed || isToggling) && styles.buttonPressed,
          ]}
        >
          {isToggling ? (
            <ActivityIndicator color={service.isActive ? '#b91c1c' : '#047857'} />
          ) : (
            <Text style={service.isActive ? styles.deactivateText : styles.activateText}>
              {service.isActive ? 'Desactivar servicio' : 'Reactivar servicio'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#475569',
    fontSize: 15,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorText: {
    color: '#b91c1c',
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  backButton: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  actionArea: {
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 16,
  },
  deactivateButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  activateButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  deactivateText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },
  activateText: {
    color: '#047857',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
