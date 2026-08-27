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

export default function SignUpScreen() {
  const { signUp, status } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status !== 'signed-out' && status !== 'error') {
    return <Redirect href="/" />;
  }

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Ingresá tu email y una contraseña.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== passwordConfirmation) {
      setErrorMessage('Las contraseñas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setConfirmationMessage(null);

    try {
      const result = await signUp(email, password);

      if (result.requiresEmailConfirmation) {
        setConfirmationMessage(
          'Revisá tu correo y confirmá la cuenta. Luego volvé a iniciar sesión para crear el salón.'
        );
      } else {
        router.replace('/');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
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
        <Text style={styles.eyebrow}>PRIMER ACCESO</Text>
        <Text style={styles.title}>Creá tu cuenta</Text>
        <Text style={styles.subtitle}>
          El primer registro crea una cuenta de owner. Después vas a configurar el salón.
        </Text>

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
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Text style={styles.label}>Repetir contraseña</Text>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPasswordConfirmation}
          placeholder="Repetí la contraseña"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.input}
          value={passwordConfirmation}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        {confirmationMessage ? <Text style={styles.success}>{confirmationMessage}</Text> : null}

        <Pressable
          disabled={isSubmitting || Boolean(confirmationMessage)}
          onPress={() => void handleSignUp()}
          style={({ pressed }) => [
            styles.primaryButton,
            Boolean(pressed || isSubmitting || confirmationMessage) && styles.buttonPressed,
          ]}
        >
          {isSubmitting ? <ActivityIndicator color={colors.bgSurface} /> : <Text style={styles.primaryButtonText}>Crear cuenta</Text>}
        </Pressable>

        <Pressable disabled={isSubmitting} onPress={() => router.replace('/sign-in')}>
          <Text style={styles.link}>Ya tengo una cuenta</Text>
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
  success: {
    color: colors.status.confirmed.border,
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
