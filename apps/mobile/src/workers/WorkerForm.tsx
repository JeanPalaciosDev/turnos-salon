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

import type { CommissionType, WorkerDraft } from './workerRepository';

type WorkerFormProps = {
  initialValue: WorkerDraft;
  submitLabel: string;
  onSubmit: (value: WorkerDraft) => Promise<void>;
};

function parseNonNegativeInteger(value: string): number {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

export function WorkerForm({ initialValue, submitLabel, onSubmit }: WorkerFormProps) {
  const [name, setName] = useState(initialValue.name);
  const [commissionType, setCommissionType] = useState<CommissionType>(initialValue.commissionType);
  const [commissionValue, setCommissionValue] = useState(String(initialValue.commissionValue));
  const [currency, setCurrency] = useState(initialValue.commissionCurrency ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(initialValue.name);
    setCommissionType(initialValue.commissionType);
    setCommissionValue(String(initialValue.commissionValue));
    setCurrency(initialValue.commissionCurrency ?? '');
  }, [
    initialValue.name,
    initialValue.commissionType,
    initialValue.commissionValue,
    initialValue.commissionCurrency,
  ]);

  const isFixed = commissionType === 'fixed_per_service';

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        name,
        commissionType,
        commissionValue: parseNonNegativeInteger(commissionValue),
        // El repositorio fuerza undefined para percentage; acá solo pasamos lo tipeado.
        commissionCurrency: isFixed ? currency : undefined,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo guardar el trabajador.'
      );
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
            Definí cómo cobra su comisión. Un porcentaje va de 0 a 100; un monto fijo se guarda en
            la unidad mínima (por ejemplo, 5000 representa $50,00).
          </Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Ej. Ana Gómez"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Tipo de comisión</Text>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => setCommissionType('percentage')}
              style={[styles.segment, commissionType === 'percentage' && styles.segmentActive]}
            >
              <Text
                style={[
                  styles.segmentText,
                  commissionType === 'percentage' && styles.segmentTextActive,
                ]}
              >
                Porcentaje
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setCommissionType('fixed_per_service')}
              style={[styles.segment, isFixed && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, isFixed && styles.segmentTextActive]}>
                Monto fijo
              </Text>
            </Pressable>
          </View>

          <Text style={styles.label}>
            {isFixed ? 'Monto por servicio (unidad mínima)' : 'Porcentaje (0 a 100)'}
          </Text>
          <TextInput
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={setCommissionValue}
            placeholder={isFixed ? '5000' : '40'}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={commissionValue}
          />

          {isFixed ? (
            <>
              <Text style={styles.label}>Moneda</Text>
              <TextInput
                autoCapitalize="characters"
                maxLength={3}
                onChangeText={(value) => setCurrency(value.toUpperCase())}
                placeholder="ARS"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={currency}
              />
            </>
          ) : null}

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
  segmented: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingVertical: spacing.md,
  },
  segmentActive: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSoft,
  },
  segmentText: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
    fontSize: 15,
  },
  segmentTextActive: {
    color: colors.brandPrimary,
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
