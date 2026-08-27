import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';
import { canManageClients } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ClientModel } from '../../../src/database/models';
import { filterClientsByName, observeClients } from '../../../src/clients/clientRepository';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function ClientsScreen() {
  const { profile, status, syncErrorMessage, syncStatus } = useAuth();
  const [clients, setClients] = useState<ClientModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const canManage = Boolean(profile && canManageClients(profile));

  useEffect(() => {
    if (!profile || !canManage) {
      return;
    }

    const subscription = observeClients(profile).subscribe({
      next: (items) => {
        setClients(items);
        setIsLoading(false);
      },
      error: (error: unknown) => {
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los clientes.');
        setIsLoading(false);
      },
    });

    return () => subscription.unsubscribe();
  }, [canManage, profile]);

  // R7.1: el buscador filtra LOCALMENTE por nombre sobre la lista ya observada.
  const visibleClients = useMemo(
    () => filterClientsByName(clients, searchTerm),
    [clients, searchTerm]
  );

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  const hasSearch = searchTerm.trim().length > 0;

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Clientes</Text>
          <Text style={styles.subtitle}>Buscá, cargá y editá la gente que atendés.</Text>
        </View>
        <Pressable onPress={() => router.push('/clients/new')} style={styles.addButton}>
          <Text style={styles.addButtonText}>Nuevo</Text>
        </Pressable>
      </View>

      {syncStatus === 'syncing' ? <Text style={styles.syncing}>Sincronizando cambios…</Text> : null}
      {syncStatus === 'error' && syncErrorMessage ? (
        <Text style={styles.syncError}>Guardado localmente. {syncErrorMessage}</Text>
      ) : null}

      {!isLoading && !errorMessage && clients.length > 0 ? (
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSearchTerm}
          placeholder="Buscar por nombre…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          value={searchTerm}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.brandPrimary} />
          <Text style={styles.subtitle}>Cargando clientes…</Text>
        </View>
      ) : errorMessage ? (
        <Text style={styles.syncError}>{errorMessage}</Text>
      ) : clients.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Todavía no cargaste clientes</Text>
          <Text style={styles.emptyText}>
            Sumá al primero para tenerlo a mano cuando armes un turno.
          </Text>
          <Pressable onPress={() => router.push('/clients/new')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Cargar cliente</Text>
          </Pressable>
        </View>
      ) : visibleClients.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Sin coincidencias</Text>
          <Text style={styles.emptyText}>
            No encontramos a nadie con “{searchTerm.trim()}”. Probá con otro nombre.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {visibleClients.map((client) => (
            <Pressable
              key={client.id}
              onPress={() => router.push(`/clients/${client.id}`)}
              style={({ pressed }) => [styles.clientCard, pressed && styles.pressed]}
            >
              <View style={styles.clientMain}>
                <Text style={styles.clientName}>{client.name}</Text>
                {client.phone ? (
                  <Text style={styles.clientDetails}>{client.phone}</Text>
                ) : (
                  <Text style={styles.clientMuted}>Sin teléfono</Text>
                )}
                {client.notes ? (
                  <Text numberOfLines={1} style={styles.clientNotes}>
                    {client.notes}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!isLoading && !errorMessage && hasSearch && visibleClients.length > 0 ? (
        <Text style={styles.count}>
          {visibleClients.length === 1
            ? '1 cliente coincide'
            : `${visibleClients.length} clientes coinciden`}
        </Text>
      ) : null}
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
  search: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.control,
    backgroundColor: colors.bgSurface,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
  clientCard: {
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.card,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  clientMain: {
    flex: 1,
    gap: spacing.xs,
  },
  clientName: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  clientDetails: {
    color: colors.textSecondary,
    ...typography.body,
  },
  clientMuted: {
    color: colors.textMuted,
    ...typography.body,
  },
  clientNotes: {
    color: colors.textSecondary,
    ...typography.small,
  },
  count: {
    color: colors.textMuted,
    ...typography.small,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
