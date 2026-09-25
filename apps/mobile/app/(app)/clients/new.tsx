import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  ClientValidationError,
  createClient,
} from '../../../src/clients/clientRepository';
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
 * Pantalla 20 — Clientes, Nuevo (§8.6). Conectada a createClient.
 * Nota: la base actual no tiene columna email; el diseño lo pide, así que se
 * guarda en `notes` hasta que se agregue una columna dedicada (ver README §11).
 */
export default function ClientNewScreen() {
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  const onSave = async () => {
    if (!profile) return;
    setBusy(true);
    setErrors([]);
    try {
      await createClient(profile, {
        name,
        phone: phone.trim() || undefined,
        notes: email.trim() ? `Email: ${email.trim()}` : undefined,
      });
      await syncNow();
      router.back();
    } catch (e) {
      if (e instanceof ClientValidationError) setErrors(e.messages);
      else setErrors([e instanceof Error ? e.message : 'No se pudo guardar el cliente.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Nuevo cliente" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Nombre" required />
          <FormInput value={name} onChangeText={setName} placeholder="Nombre del cliente" />
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

        <FormGroup>
          <FormLabel label="Email" optional />
          <FormInput
            value={email}
            onChangeText={setEmail}
            placeholder="cliente@correo.com"
            keyboardType="email-address"
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
            label={busy ? 'Guardando…' : 'Guardar cliente'}
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
