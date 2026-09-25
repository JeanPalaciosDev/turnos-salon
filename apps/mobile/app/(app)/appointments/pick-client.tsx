import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeClients } from '../../../src/clients/clientRepository';
import type { ClientModel } from '../../../src/database/models';
import { useObservable } from '../../../src/lib/useObservable';
import { patchAppointmentDraft } from '../../../src/appointments/appointmentDraft';
import { Button } from '../../../src/components/atoms';
import {
  ModalPanel,
  PickerCreateRow,
  PickerModalHeader,
  PickerOptionRow,
} from '../../../src/components/modals';
import { createStyles } from '../../../src/theme';

/** Pantalla 18 — Buscador de clientes (§8.7). Selección única, datos reales. */
export default function PickClientModal() {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const styles = useStyles();

  const clients = useObservable(
    () => (profile ? observeClients(profile) : undefined),
    [profile?.id],
    [] as ClientModel[],
  );

  const confirm = () => {
    const chosen = clients.find((c) => c.id === selected);
    if (chosen) {
      patchAppointmentDraft({ clientId: chosen.id, clientName: chosen.name });
    }
    router.back();
  };

  return (
    <ModalPanel visible onClose={() => router.back()}>
      <PickerModalHeader title="Clientes" onClose={() => router.back()} />
      <ScrollView style={styles.list}>
        <PickerCreateRow
          label="Crear nuevo cliente"
          onPress={() => router.push('/(app)/clients/new')}
        />
        {clients.map((c) => (
          <PickerOptionRow
            key={c.id}
            label={c.name}
            avatar={{ name: c.name }}
            selected={selected === c.id}
            onPress={() => setSelected(c.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button variant="primary" label="Confirmar selección" onPress={confirm} />
      </View>
    </ModalPanel>
  );
}

const useStyles = createStyles((t) => ({
  list: { marginHorizontal: -t.spacing.xl },
  footer: { paddingTop: t.spacing.md },
}));
