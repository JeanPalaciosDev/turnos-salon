import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import {
  WorkerValidationError,
  getWorker,
  updateWorker,
  type CommissionType,
} from '../../../../src/workers/workerRepository';
import { AppScreen } from '../../../../src/components/AppScreen';
import { Button } from '../../../../src/components/atoms';
import {
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
} from '../../../../src/components/forms';
import { createStyles } from '../../../../src/theme';

/**
 * Trabajadores, Editar. Precarga con getWorker; edita Nombre + Teléfono y
 * PRESERVA la comisión existente (el diseño no la muestra).
 */
export default function WorkerEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  // Comisión preservada del registro cargado.
  const commission = useRef<{ type: CommissionType; value: number; currency?: string }>({
    type: 'percentage',
    value: 0,
    currency: undefined,
  });
  const styles = useStyles();

  useEffect(() => {
    if (!profile || !id) return;
    let alive = true;
    void getWorker(profile, id)
      .then((w) => {
        if (!alive) return;
        setName(w.name);
        setPhone(w.phone ?? '');
        commission.current = {
          type: w.commissionType,
          value: w.commissionValue,
          currency: w.commissionCurrency,
        };
        setLoaded(true);
      })
      .catch((e) => setErrors([e instanceof Error ? e.message : 'No se pudo cargar el trabajador.']));
    return () => {
      alive = false;
    };
  }, [profile, id]);

  const onSave = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setErrors([]);
    try {
      await updateWorker(profile, id, {
        name,
        commissionType: commission.current.type,
        commissionValue: commission.current.value,
        commissionCurrency: commission.current.currency,
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
      <FormHeaderRow title="Editar trabajador" onBack={() => router.back()} />
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
            label={busy ? 'Guardando…' : 'Guardar cambios'}
            onPress={() => void onSave()}
            disabled={busy || !loaded}
          />
          <Button
            variant="danger-ghost"
            label="Eliminar trabajador"
            onPress={() => router.push(`/(app)/workers/${id}/delete`)}
          />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
