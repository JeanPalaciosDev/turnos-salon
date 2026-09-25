import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { patchAppointmentDraft } from '../../../src/appointments/appointmentDraft';
import { Calendar } from '../../../src/components/modals';
import { createStyles } from '../../../src/theme';

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pantalla 15 — Selector de fecha (§8.7). allowPast=false, escribe en el borrador. */
export default function PickDateModal() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const styles = useStyles();

  const confirm = () => {
    if (selected) patchAppointmentDraft({ date: iso(selected) });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Calendar
        selected={selected}
        onSelect={setSelected}
        allowPast={false}
        onCancel={() => router.back()}
        onConfirm={confirm}
      />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: t.spacing.xl,
    backgroundColor: t.palette.bgSurface,
  },
}));
