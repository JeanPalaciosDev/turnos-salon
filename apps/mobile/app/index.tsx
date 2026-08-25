import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthProvider';

function StatusScreen({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string | null;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {onRetry ? (
        <Pressable style={styles.button} onPress={onRetry}>
          <Text style={styles.buttonText}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function IndexScreen() {
  const { status, errorMessage, retry } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.message}>Restaurando tu sesión…</Text>
      </View>
    );
  }

  if (status === 'configuration-error') {
    return (
      <StatusScreen
        title="Configura Supabase"
        message={
          errorMessage ??
          'Copiá apps/mobile/.env.example como .env.local y completá las variables públicas.'
        }
      />
    );
  }

  if (status === 'error') {
    return (
      <StatusScreen
        title="No se pudo abrir la sesión"
        message={errorMessage}
        onRetry={() => void retry()}
      />
    );
  }

  if (status === 'signed-out') {
    return <Redirect href="/sign-in" />;
  }

  if (status === 'needs-bootstrap') {
    return <Redirect href="/business" />;
  }

  return <Redirect href="/home" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: '#475569',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
