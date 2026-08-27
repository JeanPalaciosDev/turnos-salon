import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Redirect, router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { colors, radius, shadow, spacing, typography } from '../../src/theme';

export default function SignInScreen() {
  const { signIn, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status !== 'signed-out' && status !== 'error') {
    return <Redirect href="/" />;
  }

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Ingresá tu email y contraseña.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.eyebrow}>TURNOS SALÓN</Text>
        <Text style={styles.title}>Bienvenido</Text>
        <Text style={styles.subtitle}>Iniciá sesión para sincronizar la agenda de tu salón.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="nombre@salon.com"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Tu contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          onPress={() => void handleSignIn()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isSubmitting) && styles.buttonPressed,
          ]}
        >
          {isSubmitting ? <ActivityIndicator color={colors.bgSurface} /> : <Text style={styles.primaryButtonText}>Ingresar</Text>}
        </Pressable>

        <Pressable disabled={isSubmitting} onPress={() => router.push('/sign-up')}>
          <Text style={styles.link}>¿Todavía no tenés cuenta? Crear cuenta de owner</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bgBase,
  },
  card: {
    gap: spacing.md,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.xl,
    ...shadow.raised,
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
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    color: colors.textPrimary,
    ...typography.bodyStrong,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.control,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  error: {
    color: colors.status.cancelled.border,
    ...typography.body,
  },
  primaryButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonPressed: {
    backgroundColor: colors.brandPrimaryPressed,
  },
  primaryButtonText: {
    color: colors.bgSurface,
    ...typography.bodyStrong,
    fontSize: 16,
  },
  link: {
    color: colors.brandPrimary,
    ...typography.bodyStrong,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
});
