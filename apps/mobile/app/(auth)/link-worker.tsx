import {useState} from 'react';
import {Text, TextInput, View} from 'react-native';
import {router} from 'expo-router';

import {useAuth} from '../../src/auth/AuthProvider';
import {redeemInviteCode} from '../../src/auth/redeemInviteCode';
import {AppScreen} from '../../src/components';
import {Button} from '../../src/components/atoms';
import {FormFooter, FormGroup, FormHeaderRow, FormHint, FormLabel} from '../../src/components/forms';
import {createStyles} from '../../src/theme';

/**
 * Pantalla de vinculación de worker por código de 6 dígitos. El profesional
 * ingresa el código que generó el dueño del salón. Al éxito se refresca el
 * perfil con retry() para que el AuthProvider enrute al área de la app.
 */
export default function LinkWorkerScreen() {
  const {retry} = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles();

  const onLink = async () => {
    setBusy(true);
    setError(null);
    try {
      await redeemInviteCode(code);
      await retry();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo vincular la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Vincular cuenta" onBack={() => router.push('/(auth)/choose-role')}/>

      <View style={styles.body}>
        <Text style={styles.description}>
          Ingresa el código de 6 dígitos que te dio el dueño del salón.
        </Text>

        <FormGroup>
          <FormLabel label="Código de vinculación" required/>
          <TextInput
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            style={[
              styles.codeInput,
              code.length === 6 && styles.codeInputFull,
            ]}
            placeholderTextColor={styles.placeholder.color as string}
            accessibilityLabel="Código de 6 dígitos"
          />
          <FormHint text="El código tiene 60 segundos de validez."/>
        </FormGroup>

        {error ? <FormHint text={error} variant="error"/> : null}
      </View>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Vinculando…' : 'Vincular'}
            onPress={() => void onLink()}
            disabled={busy || code.length !== 6}
          />
          <Button
            variant="secondary"
            label="Volver"
            onPress={() => router.push('/(auth)/choose-role')}
            disabled={busy}
          />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: {
    flex: 1,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl,
    gap: t.spacing.lg,
  },
  description: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
  },
  codeInput: {
    backgroundColor: t.palette.bgSurface,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.control,
    height: 56,
    paddingHorizontal: t.spacing.xl,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
    color: t.palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  codeInputFull: {
    borderColor: t.palette.brandPrimary,
    borderWidth: 2,
  },
  placeholder: {
    color: t.palette.textMuted,
  },
  footerWrap: {paddingBottom: t.spacing.lg},
}));
