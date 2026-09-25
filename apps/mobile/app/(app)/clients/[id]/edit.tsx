import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import {
  ClientValidationError,
  getClient,
  updateClient,
} from '../../../../src/clients/clientRepository';
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

function emailFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = /^Email:\s*(.*)$/.exec(notes);
  return match ? match[1] : '';
}

/** Clientes, Editar. Precarga con getClient; edita Nombre + Teléfono + Email(→notes). */
export default function ClientEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  useEffect(() => {
    if (!profile || !id) return;
    let alive = true;
    void getClient(profile, id)
      .then((c) => {
        if (!alive) return;
        setName(c.name);
        setPhone(c.phone ?? '');
        setEmail(emailFromNotes(c.notes));
        setLoaded(true);
      })
      .catch((e) => setErrors([e instanceof Error ? e.message : 'No se pudo cargar el cliente.']));
    return () => {
      alive = false;
    };
  }, [profile, id]);

  const onSave = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setErrors([]);
    try {
      await updateClient(profile, id, {
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
      <FormHeaderRow title="Editar cliente" onBack={() => router.back()} />
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
            label={busy ? 'Guardando…' : 'Guardar cambios'}
            onPress={() => void onSave()}
            disabled={busy || !loaded}
          />
          <Button
            variant="danger-ghost"
            label="Eliminar cliente"
            onPress={() => router.push(`/(app)/clients/${id}/delete`)}
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
