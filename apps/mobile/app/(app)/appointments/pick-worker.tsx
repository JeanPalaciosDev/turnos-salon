import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeWorkers } from '../../../src/workers/workerRepository';
import type { WorkerModel } from '../../../src/database/models';
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

const UNASSIGNED = 'none';

/** Pantalla 19 — Buscador de trabajadores (§8.7). Con "Sin asignar", datos reales. */
export default function PickWorkerModal() {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string>(UNASSIGNED);
  const styles = useStyles();

  const workers = useObservable(
    () => (profile ? observeWorkers(profile) : undefined),
    [profile?.id],
    [] as WorkerModel[],
  );

  const confirm = () => {
    if (selected === UNASSIGNED) {
      patchAppointmentDraft({ workerId: undefined, workerName: 'Sin asignar' });
    } else {
      const chosen = workers.find((w) => w.id === selected);
      if (chosen) patchAppointmentDraft({ workerId: chosen.id, workerName: chosen.name });
    }
    router.back();
  };

  return (
    <ModalPanel visible onClose={() => router.back()}>
      <PickerModalHeader title="Trabajadores" onClose={() => router.back()} />
      <ScrollView style={styles.list}>
        <PickerCreateRow
          label="Crear nuevo trabajador"
          onPress={() => router.push('/(app)/workers/new')}
        />
        <PickerOptionRow
          label="Sin asignar"
          selected={selected === UNASSIGNED}
          onPress={() => setSelected(UNASSIGNED)}
        />
        {workers.map((w) => (
          <PickerOptionRow
            key={w.id}
            label={w.name}
            avatar={{ name: w.name }}
            selected={selected === w.id}
            onPress={() => setSelected(w.id)}
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
