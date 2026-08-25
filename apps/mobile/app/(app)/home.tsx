import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';

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
            : 'Tu sesión está lista. La pantalla de agenda de trabajador será el próximo módulo.'}
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
            <ActivityIndicator color="#1d4ed8" />
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
          <Pressable onPress={() => router.push('/services')} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Gestionar servicios</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Siguiente paso</Text>
          <Text style={styles.nextText}>
            Conectar el flujo de invitación de trabajadores y la agenda personal.
          </Text>
        </View>
      )}

      <Pressable
        disabled={isSigningOut}
        onPress={confirmSignOut}
        style={({ pressed }) => [styles.signOutButton, (pressed || isSigningOut) && styles.buttonPressed]}
      >
        {isSigningOut ? <ActivityIndicator color="#b91c1c" /> : <Text style={styles.signOutText}>Cerrar sesión</Text>}
      </Pressable>
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
  hero: {
    gap: 8,
    paddingTop: 8,
  },
  eyebrow: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#0f172a',
    fontSize: 30,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    gap: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  cardLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  email: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  role: {
    color: '#475569',
    fontSize: 15,
  },
  syncStatus: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '700',
  },
  syncError: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 10,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  secondaryButtonText: {
    color: '#1d4ed8',
    fontSize: 15,
    fontWeight: '800',
  },
  nextCard: {
    gap: 8,
    borderRadius: 16,
    backgroundColor: '#e0f2fe',
    padding: 18,
  },
  nextTitle: {
    color: '#0c4a6e',
    fontSize: 16,
    fontWeight: '800',
  },
  nextText: {
    color: '#075985',
    fontSize: 15,
    lineHeight: 22,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  signOutButton: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    marginTop: 'auto',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  signOutText: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.65,
  },
});
