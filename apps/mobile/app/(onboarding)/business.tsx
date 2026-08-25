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
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={name}
        />

        <Text style={styles.label}>Moneda base</Text>
        <TextInput
          autoCapitalize="characters"
          maxLength={3}
          onChangeText={(value) => setBaseCurrency(value.toUpperCase())}
          placeholder="ARS"
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={baseCurrency}
        />

        <Text style={styles.label}>Zona horaria</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setTimezone}
          placeholder={DEFAULT_TIMEZONE}
          placeholderTextColor="#94a3b8"
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
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Crear salón</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#eff6ff',
  },
  card: {
    gap: 12,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
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
    marginBottom: 8,
    color: '#475569',
    fontSize: 16,
    lineHeight: 22,
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
  primaryButton: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#1d4ed8',
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
