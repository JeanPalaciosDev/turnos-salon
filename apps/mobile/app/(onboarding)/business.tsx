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

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export default function BusinessOnboardingScreen() {
  const { completeOwnerBootstrap, status } = useAuth();
  const [name, setName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('ARS');
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (status !== 'needs-bootstrap') {
    return <Redirect href="/" />;
  }

  const handleCreateBusiness = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await completeOwnerBootstrap({ name, baseCurrency, timezone });
      router.replace('/');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo crear el salón.');
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
        <Text style={styles.eyebrow}>CONFIGURACIÓN INICIAL</Text>
        <Text style={styles.title}>Creá tu salón</Text>
        <Text style={styles.subtitle}>
          Esta cuenta será owner. Los trabajadores se incorporarán mediante un flujo de invitación en una próxima etapa.
        </Text>

        <Text style={styles.label}>Nombre del salón</Text>
        <TextInput
          autoCapitalize="words"
          onChangeText={setName}
          placeholder="Ej. Salón Aurora"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={name}
        />

        <Text style={styles.label}>Moneda base</Text>
        <TextInput
          autoCapitalize="characters"
          maxLength={3}
          onChangeText={(value) => setBaseCurrency(value.toUpperCase())}
          placeholder="ARS"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={baseCurrency}
        />

        <Text style={styles.label}>Zona horaria</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setTimezone}
          placeholder={DEFAULT_TIMEZONE}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={timezone}
        />

        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <Pressable
          disabled={isSubmitting}
          onPress={() => void handleCreateBusiness()}
          style={({ pressed }) => [
            styles.primaryButton,
            (pressed || isSubmitting) && styles.buttonPressed,
          ]}
        >
          {isSubmitting ? <ActivityIndicator color={colors.bgSurface} /> : <Text style={styles.primaryButtonText}>Crear salón</Text>}
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
});
