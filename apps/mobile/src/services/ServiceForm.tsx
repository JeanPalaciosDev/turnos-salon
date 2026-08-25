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

import type { ServiceDraft } from './serviceRepository';

type ServiceFormProps = {
  initialValue: ServiceDraft;
  submitLabel: string;
  onSubmit: (value: ServiceDraft) => Promise<void>;
};

function parsePositiveInteger(value: string): number {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

export function ServiceForm({ initialValue, submitLabel, onSubmit }: ServiceFormProps) {
  const [name, setName] = useState(initialValue.name);
  const [duration, setDuration] = useState(String(initialValue.durationMinutes));
  const [priceAmount, setPriceAmount] = useState(String(initialValue.defaultPriceAmount));
  const [currency, setCurrency] = useState(initialValue.defaultPriceCurrency);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(initialValue.name);
    setDuration(String(initialValue.durationMinutes));
    setPriceAmount(String(initialValue.defaultPriceAmount));
    setCurrency(initialValue.defaultPriceCurrency);
  }, [
    initialValue.defaultPriceAmount,
    initialValue.defaultPriceCurrency,
    initialValue.durationMinutes,
    initialValue.name,
  ]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit({
        name,
        durationMinutes: parsePositiveInteger(duration),
        defaultPriceAmount: parsePositiveInteger(priceAmount),
        defaultPriceCurrency: currency,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No se pudo guardar el servicio.');
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
            Los importes se guardan en la unidad mínima: por ejemplo, 5000 representa $50,00.
          </Text>

          <Text style={styles.label}>Nombre</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Ej. Corte de pelo"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={name}
          />

          <Text style={styles.label}>Duración (minutos)</Text>
          <TextInput
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={setDuration}
            placeholder="45"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={duration}
          />

          <Text style={styles.label}>Precio (unidad mínima)</Text>
          <TextInput
            inputMode="numeric"
            keyboardType="number-pad"
            onChangeText={setPriceAmount}
            placeholder="5000"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={priceAmount}
          />

          <Text style={styles.label}>Moneda</Text>
          <TextInput
            autoCapitalize="characters"
            maxLength={3}
            onChangeText={(value) => setCurrency(value.toUpperCase())}
            placeholder="ARS"
            placeholderTextColor="#94a3b8"
            style={styles.input}
            value={currency}
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
            {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.submitText}>{submitLabel}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flexGrow: 1,
    padding: 20,
  },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  helper: {
    marginBottom: 4,
    color: '#475569',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    color: '#0f172a',
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: {
    color: '#b91c1c',
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});
