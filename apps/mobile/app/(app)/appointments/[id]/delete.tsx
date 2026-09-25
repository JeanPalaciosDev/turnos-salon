import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { cancelAppointment } from '../../../../src/appointments/appointmentRepository';
import { ConfirmModal } from '../../../../src/components/modals';

/** Confirmar cancelación de turno, modal. Cancelar = transición de estado. */
export default function AppointmentDeleteModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (!profile || !id) return;
    setBusy(true);
    try {
      await cancelAppointment(profile, id);
      await syncNow();
    } finally {
      router.replace('/(app)/agenda');
    }
  };

  return (
    <ConfirmModal
      visible
      title="¿Cancelar turno?"
      message="El turno quedará cancelado."
      confirmLabel={busy ? 'Cancelando…' : 'Cancelar turno'}
      cancelLabel="Volver"
      onConfirm={() => void onConfirm()}
      onCancel={() => router.back()}
    />
  );
}
