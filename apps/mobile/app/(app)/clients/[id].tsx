import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { canManageClients } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ClientModel } from '../../../src/database/models';
import { ClientForm } from '../../../src/clients/ClientForm';
import {
  deleteClient,
  getClient,
  type ClientDraft,
  updateClient,
} from '../../../src/clients/clientRepository';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, status, syncNow } = useAuth();
  const [client, setClient] = useState<ClientModel | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const clientId = Array.isArray(id) ? id[0] : id;
  const canManage = Boolean(profile && canManageClients(profile));

  useEffect(() => {
    if (!profile || !canManage || !clientId) {
      return;
    }

    let isMounted = true;

    void getClient(profile, clientId)
      .then((value) => {
        if (isMounted) {
          setClient(value);
          setIsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'No se pudo cargar el cliente.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canManage, profile, clientId]);

  const initialValue = useMemo<ClientDraft | null>(() => {
    if (!client) {
      return null;
    }

    return {
      name: client.name,
      phone: client.phone,
      notes: client.notes,
    };
  }, [client]);

  if (status !== 'ready' || !profile || !canManage || !clientId) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: ClientDraft) => {
    await updateClient(profile, clientId, draft);
    await syncNow();
    router.replace('/clients');
  };

  const handleDelete = async () => {
    if (!client) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteClient(profile, client.id);
      await syncNow();
      router.replace('/clients');
    } catch (error) {
      Alert.alert(
        'No se pudo eliminar el cliente',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (!client) {
      return;
    }

    Alert.alert(
      'Eliminar cliente',
      `${client.name} dejará de aparecer en la lista, pero se conserva el historial de turnos existente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => void handleDelete() },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Cargando cliente…</Text>
      </View>
    );
  }

  if (errorMessage || !client || !initialValue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{errorMessage ?? 'El cliente no existe.'}</Text>
        <Pressable onPress={() => router.replace('/clients')} style={styles.backButton}>
          <Text style={styles.backButtonText}>Volver a clientes</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ClientForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar cambios" />
      <View style={styles.actionArea}>
        <Pressable
          disabled={isDeleting}
          onPress={confirmDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            (pressed || isDeleting) && styles.buttonPressed,
          ]}
        >
          {isDeleting ? (
            <ActivityIndicator color={colors.status.cancelled.border} />
          ) : (
            <Text style={styles.deleteText}>Eliminar cliente</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  errorText: {
    color: colors.status.cancelled.border,
    ...typography.body,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  backButton: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  actionArea: {
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  deleteButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.control,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  deleteText: {
    color: colors.status.cancelled.border,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
