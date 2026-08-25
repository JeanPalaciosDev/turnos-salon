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
          placeholderTextColor="#94a3b8"
          style={styles.input}
          value={email}
        />

        <Text style={styles.label}>Contraseña</Text>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPassword}
          placeholder="Mínimo 8 caracteres"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          style={styles.input}
          value={password}
        />

        <Text style={styles.label}>Repetir contraseña</Text>
        <TextInput
          autoComplete="new-password"
          onChangeText={setPasswordConfirmation}
          placeholder="Repetí la contraseña"
          placeholderTextColor="#94a3b8"
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
          {isSubmitting ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryButtonText}>Crear cuenta</Text>}
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
  success: {
    color: '#047857',
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
  link: {
    color: '#1d4ed8',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
    textAlign: 'center',
  },
});
