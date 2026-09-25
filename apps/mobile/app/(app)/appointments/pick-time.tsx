import { View } from 'react-native';
import { router } from 'expo-router';

import { patchAppointmentDraft } from '../../../src/appointments/appointmentDraft';
import { Clock } from '../../../src/components/modals';
import { createStyles } from '../../../src/theme';

/** Pantalla 16 — Selector de hora (§8.7). Reloj de dos pasos, escribe en el borrador. */
export default function PickTimeModal() {
  const styles = useStyles();

  const confirm = (hour: number, minute: number) => {
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    patchAppointmentDraft({ time });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Clock onConfirm={confirm} onCancel={() => router.back()} />
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
