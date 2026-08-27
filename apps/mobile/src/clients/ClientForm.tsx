import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { colors, radius, shadow, spacing, typography } from '../theme';

import type { ClientDraft } from './clientRepository';

type ClientFormProps = {
  initialValue: ClientDraft;
  submitLabel: string;
  onSubmit: (value: ClientDraft) => Promise<void>;
};

export function ClientForm({ initialValue, submitLabel, onSubmit }: ClientFormProps) {
  const [name, setName] = useState(initialValue.name);
  const [phone, setPhone] = useState(initialValue.phone ?? '');
  const [notes, setNotes] = useState(initialValue.notes ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(initialValue.name);
    setPhone(initialValue.phone ?? '');
    setNotes(initialValue.notes ?? '');
  }, [initialValue.name, initialValue.phone, initialValue.notes]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        name,
        // El repositorio normaliza vacíos a undefined; acá solo pasamos el texto tipeado.
        phone,
        notes,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el cliente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.helper}>
            El nombre es lo único obligatorio. Sumá teléfono y notas si te sirven para el día a día.
          </Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Ej. María López"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Teléfono (opcional)</Text>
          <TextInput
            inputMode="tel"
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="Ej. 11 2345 6789"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={phone}
          />

          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Preferencias, alergias, recordatorios…"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.notesInput]}
            value={notes}
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            disabled={isSubmitting}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isSubmitting) && styles.buttonPressed,
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.bgSurface} />
            ) : (
              <Text style={styles.submitText}>{submitLabel}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bgBase,
  },
  content: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.panel,
    backgroundColor: colors.bgSurface,
    padding: spacing.lg,
    ...shadow.soft,
  },
  helper: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    ...typography.body,
  },
  label: {
    color: colors.textPrimary,
    ...typography.body,
    fontWeight: '600',
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
  notesInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.status.cancelled.border,
    ...typography.body,
  },
  submitButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: colors.brandPrimary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  submitText: {
    color: colors.bgSurface,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonPressed: {
    backgroundColor: colors.brandPrimaryPressed,
  },
});
