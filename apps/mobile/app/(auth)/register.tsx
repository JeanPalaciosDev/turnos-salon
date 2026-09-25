import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppScreen } from '../../src/components/AppScreen';
import { BackArrow, Button, LinkText } from '../../src/components/atoms';
import { FormGroup, FormHeaderRow, FormHint, FormInput, FormLabel } from '../../src/components/forms';
import { createStyles } from '../../src/theme';

/** Pantalla 3 — Crear cuenta. Registro real vía useAuth. */
export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const styles = useStyles();

  const onSubmit = async () => {
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { requiresEmailConfirmation } = await signUp(email, password);
      if (requiresEmailConfirmation) {
        setNotice('Revisá tu email para confirmar la cuenta y luego ingresá.');
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <View style={styles.container}>
        <FormHeaderRow
          title="Crea tu cuenta"
          onBack={() => router.back()}
        />

        <View style={styles.form}>
          <FormGroup>
            <FormLabel label="Nombre completo" />
            <FormInput
              value={name}
              onChangeText={setName}
              placeholder="Ej: Martina Ríos"
            />
          </FormGroup>

          <FormGroup>
            <FormLabel label="Email" />
            <FormInput
              value={email}
              onChangeText={setEmail}
              placeholder="tu@correo.com"
              keyboardType="email-address"
            />
          </FormGroup>

          <FormGroup>
            <FormLabel label="Contraseña" />
            <FormInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
          </FormGroup>

          <FormGroup>
            <FormLabel label="Confirmar contraseña" />
            <FormInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repetí tu contraseña"
              secureTextEntry
            />
          </FormGroup>

          {error ? <FormHint text={error} variant="error" /> : null}
          {notice ? <FormHint text={notice} /> : null}

          <Button
            variant="primary"
            label={busy ? 'Creando…' : 'Crear cuenta'}
            onPress={() => void onSubmit()}
            disabled={busy}
          />

          <View style={styles.linkRow}>
            <LinkText
              label="Ya tengo cuenta — Ingresar"
              onPress={() => router.push('/(auth)/login')}
            />
          </View>
        </View>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flex: 1,
    paddingTop: t.spacing.lg,
  },
  form: {
    gap: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl,
  },
  linkRow: { alignItems: 'center', marginTop: t.spacing.sm },
}));
