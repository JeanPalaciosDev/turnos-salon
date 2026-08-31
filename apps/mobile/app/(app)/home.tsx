import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { colors, radius, spacing, typography } from '../../src/theme';

const syncLabels = {
  idle: 'Sin sincronizar todavía',
  syncing: 'Sincronizando…',
  synced: 'Base local sincronizada',
  error: 'No se pudo sincronizar',
} as const;

export default function HomeScreen() {
  const { profile, signOut, status, syncErrorMessage, syncNow, syncStatus } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (status !== 'ready' || !profile) {
    return <Redirect href="/" />;
  }

  const isOwner = profile.role === 'owner';

  const handleSync = async () => {
    await syncNow();
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);

    try {
      await signOut();
    } catch (error) {
      Alert.alert(
        'No se pudo cerrar sesión',
        error instanceof Error ? error.message : 'Intentá nuevamente.'
      );
    } finally {
      setIsSigningOut(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      'Se eliminarán los datos locales de este dispositivo para proteger la información del salón. Sincronizá antes de continuar si tenés cambios sin enviar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión y borrar datos',
          style: 'destructive',
          onPress: () => void handleSignOut(),
        },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{isOwner ? 'CUENTA OWNER' : 'CUENTA WORKER'}</Text>
        <Text style={styles.title}>{isOwner ? 'Panel del salón' : 'Mi agenda'}</Text>
        <Text style={styles.subtitle}>
          {isOwner
            ? 'Gestioná servicios y prepará los datos que usará la agenda diaria.'
            : 'Revisá tu agenda del día y marcá tus turnos como completados.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>SESION ACTIVA</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <Text style={styles.role}>{isOwner ? 'Propietario' : 'Trabajador'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>SINCRONIZACIÓN</Text>
        <Text style={styles.syncStatus}>{syncLabels[syncStatus]}</Text>
        {syncErrorMessage ? <Text style={styles.syncError}>{syncErrorMessage}</Text> : null}
        <Pressable
          disabled={syncStatus === 'syncing'}
          onPress={() => void handleSync()}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || syncStatus === 'syncing') && styles.buttonPressed,
          ]}
        >
          {syncStatus === 'syncing' ? (
            <ActivityIndicator color={colors.brandPrimary} />
          ) : (
            <Text style={styles.secondaryButtonText}>Sincronizar ahora</Text>
          )}
        </Pressable>
      </View>

      {isOwner ? (
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Configuración del salón</Text>
          <Text style={styles.nextText}>
            Creá, editá, desactivá o reactivá los servicios que estarán disponibles al agendar turnos.
          </Text>
          <Pressable onPress={() => router.push('/appointments')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Abrir agenda del día</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/services')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Gestionar servicios</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/clients')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Gestionar clientes</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/workers')} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Gestionar trabajadores</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Tu agenda</Text>
          <Text style={styles.nextText}>
            Consultá los turnos asignados a tu nombre para el día seleccionado.
          </Text>
          <Pressable onPress={() => router.push('/appointments')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Ver mi agenda</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        disabled={isSigningOut}
        onPress={confirmSignOut}
        style={({ pressed }) => [styles.signOutButton, (pressed || isSigningOut) && styles.buttonPressed]}
      >
        {isSigningOut ? <ActivityIndicator color={colors.status.cancelled.border} /> : <Text style={styles.signOutText}>Cerrar sesión</Text>}
      </Pressable>
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
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  eyebrow: {
    color: colors.brandPrimary,
    ...typography.small,
    letterSpacing: 1.2,
  },
  title: {
    color: colors.textPrimary,
    ...typography.display,
  },
  subtitle: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
  },
  cardLabel: {
    color: colors.textMuted,
    ...typography.small,
    letterSpacing: 1,
  },
  email: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  role: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
  },
  syncStatus: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  syncError: {
    color: colors.status.cancelled.border,
    ...typography.body,
  },
  secondaryButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.control,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.brandPrimary,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  nextCard: {
    gap: spacing.sm,
    borderRadius: radius.panel,
    backgroundColor: colors.brandSoft,
    padding: spacing.lg,
  },
  nextTitle: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  nextText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
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
  signOutButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.status.cancelled.border,
    borderRadius: radius.control,
    marginTop: 'auto',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  signOutText: {
    color: colors.status.cancelled.border,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
