import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppScreen } from '../../src/components/AppScreen';
import { Button, LinkText } from '../../src/components/atoms';
import { FormGroup, FormHint, FormInput, FormLabel } from '../../src/components/forms';
import { BrandBlock } from '../../src/components/detail';
import { createStyles } from '../../src/theme';

/** Pantalla 2 — Login. Autenticación real vía useAuth; el AuthProvider enruta al entrar. */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles();

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <View style={styles.container}>
        <BrandBlock />

        <View style={styles.form}>
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

          {error ? <FormHint text={error} variant="error" /> : null}

          <Button
            variant="primary"
            label={busy ? 'Ingresando…' : 'Ingresar'}
            onPress={() => void onSubmit()}
            disabled={busy}
          />

          <View style={styles.linkRow}>
            <LinkText label="¿Olvidaste tu contraseña?" onPress={() => {}} />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.linkRow}>
            <LinkText
              label="¿No tienes cuenta? Crea una"
              onPress={() => router.push('/(auth)/register')}
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
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xl,
    gap: t.spacing.xxl,
  },
  form: { gap: t.spacing.lg },
  linkRow: { alignItems: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginVertical: t.spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: t.palette.borderSubtle,
  },
  dividerText: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
}));
