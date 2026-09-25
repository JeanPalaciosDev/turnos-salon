import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  WorkerValidationError,
  createWorker,
} from '../../../src/workers/workerRepository';
import { AppScreen } from '../../../src/components/AppScreen';
import { Button } from '../../../src/components/atoms';
import {
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
} from '../../../src/components/forms';
import { createStyles } from '../../../src/theme';

/**
 * Pantalla 21 — Trabajadores, Nuevo (§8.6). Conectada a createWorker.
 * El diseño muestra Nombre + Teléfono, no comisión: se crea con comisión por
 * defecto (percentage 0) que el owner puede ajustar luego desde otra vista.
 */
export default function WorkerNewScreen() {
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  const onSave = async () => {
    if (!profile) return;
    setBusy(true);
    setErrors([]);
    try {
      await createWorker(profile, {
        name,
        commissionType: 'percentage',
        commissionValue: 0,
        commissionCurrency: undefined,
        phone: phone.trim() || undefined,
      });
      await syncNow();
      router.back();
    } catch (e) {
      if (e instanceof WorkerValidationError) setErrors(e.messages);
      else setErrors([e instanceof Error ? e.message : 'No se pudo guardar el trabajador.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Nuevo trabajador" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Nombre" required />
          <FormInput value={name} onChangeText={setName} placeholder="Nombre del trabajador" />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Teléfono" optional />
          <FormInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+598 99 000 000"
            keyboardType="phone-pad"
          />
        </FormGroup>

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar trabajador'}
            onPress={() => void onSave()}
            disabled={busy || !profile}
          />
          <Button variant="secondary" label="Cancelar" onPress={() => router.back()} />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
