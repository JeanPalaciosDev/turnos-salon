import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthProvider';
import { colors, radius, spacing, typography } from '../src/theme';

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
        <ActivityIndicator size="large" color={colors.brandPrimary} />
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
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  title: {
    color: colors.textPrimary,
    ...typography.h2,
    fontSize: 24,
    textAlign: 'center',
  },
  message: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  button: {
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 16,
  },
});
