import { useEffect, useMemo, useState } from 'react';
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

import type { AppointmentDraft } from './appointmentRepository';

export type OptionItem = {
  id: string;
  label: string;
  /** Metadato opcional (por ejemplo, duración del servicio). */
  hint?: string;
};

type AppointmentFormProps = {
  initialValue: AppointmentDraft;
  submitLabel: string;
  services: OptionItem[];
  workers: OptionItem[];
  clients: OptionItem[];
  onSubmit: (value: AppointmentDraft) => Promise<void>;
};

/**
 * Formulario de turno. La hora de fin no se pide: la deriva el repositorio a
 * partir de la duración del servicio. El error de solapamiento llega como
 * mensaje del repositorio y se muestra en el bloque de error.
 */
export function AppointmentForm({
  initialValue,
  submitLabel,
  services,
  workers,
  clients,
  onSubmit,
}: AppointmentFormProps) {
  const [date, setDate] = useState(initialValue.date);
  const [startTime, setStartTime] = useState(initialValue.startTime);
  const [serviceId, setServiceId] = useState(initialValue.serviceId);
  const [workerId, setWorkerId] = useState(initialValue.workerId);
  const [clientId, setClientId] = useState(initialValue.clientId);
  const [notes, setNotes] = useState(initialValue.notes ?? '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setDate(initialValue.date);
    setStartTime(initialValue.startTime);
    setServiceId(initialValue.serviceId);
    setWorkerId(initialValue.workerId);
    setClientId(initialValue.clientId);
    setNotes(initialValue.notes ?? '');
  }, [
    initialValue.date,
    initialValue.startTime,
    initialValue.serviceId,
    initialValue.workerId,
    initialValue.clientId,
    initialValue.notes,
  ]);

  const missingData = useMemo(
    () => services.length === 0 || workers.length === 0 || clients.length === 0,
    [services.length, workers.length, clients.length]
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        date,
        startTime,
        serviceId,
        workerId,
        clientId,
        notes: notes.trim().length > 0 ? notes : undefined,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el turno.');
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
          {missingData ? (
            <Text style={styles.helper}>
              Para agendar necesitás al menos un servicio, un profesional y un cliente cargados.
            </Text>
          ) : (
            <Text style={styles.helper}>
              La hora de fin se calcula con la duración del servicio elegido.
            </Text>
          )}

          <Text style={styles.label}>Fecha</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setDate}
            placeholder="2025-08-31"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={date}
          />

          <Text style={styles.label}>Hora de inicio</Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setStartTime}
            placeholder="09:30"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={startTime}
          />

          <Text style={styles.label}>Servicio</Text>
          <OptionPicker items={services} selectedId={serviceId} onSelect={setServiceId} emptyLabel="Sin servicios" />

          <Text style={styles.label}>Profesional</Text>
          <OptionPicker items={workers} selectedId={workerId} onSelect={setWorkerId} emptyLabel="Sin profesionales" />

          <Text style={styles.label}>Cliente</Text>
          <OptionPicker items={clients} selectedId={clientId} onSelect={setClientId} emptyLabel="Sin clientes" />

          <Text style={styles.label}>Notas (opcional)</Text>
          <TextInput
            multiline
            onChangeText={setNotes}
            placeholder="Detalles del turno"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.notesInput]}
            value={notes}
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            disabled={isSubmitting || missingData}
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isSubmitting || missingData) && styles.buttonPressed,
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

type OptionPickerProps = {
  items: OptionItem[];
  selectedId: string;
  emptyLabel: string;
  onSelect: (id: string) => void;
};

/** Selector simple táctil (chips). Evita agregar una lib de picker nueva. */
function OptionPicker({ items, selectedId, emptyLabel, onSelect }: OptionPickerProps) {
  if (items.length === 0) {
    return <Text style={styles.emptyOption}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.optionList}>
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.option, isSelected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {item.label}
            </Text>
            {item.hint ? (
              <Text style={[styles.optionHint, isSelected && styles.optionTextSelected]}>
                {item.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
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
    minHeight: 72,
    textAlignVertical: 'top',
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSoft,
  },
  optionText: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
    fontSize: 14,
  },
  optionHint: {
    color: colors.textMuted,
    ...typography.micro,
  },
  optionTextSelected: {
    color: colors.brandPrimary,
  },
  emptyOption: {
    color: colors.textMuted,
    ...typography.body,
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
