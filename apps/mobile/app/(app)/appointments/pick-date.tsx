import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { patchAppointmentDraft } from '../../../src/appointments/appointmentDraft';
import { dateToIso } from '../../../src/lib/clock';
import { Calendar } from '../../../src/components/modals';
import { createStyles } from '../../../src/theme';

/** Pantalla 15 — Selector de fecha (§8.7). allowPast=false, escribe en el borrador. */
export default function PickDateModal() {
  const [selected, setSelected] = useState<Date | undefined>(undefined);
  const styles = useStyles();

  const confirm = () => {
    if (selected) patchAppointmentDraft({ date: dateToIso(selected) });
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
