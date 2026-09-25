import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { setWorkerActive } from '../../../../src/workers/workerRepository';
import { ConfirmModal } from '../../../../src/components/modals';

/** Confirmar eliminación de trabajador, modal. Baja lógica: desactivar. */
export default function WorkerDeleteModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (!profile || !id) return;
    setBusy(true);
    try {
      await setWorkerActive(profile, id, false);
      await syncNow();
    } finally {
      router.replace('/(app)/workers');
    }
  };

  return (
    <ConfirmModal
      visible
      title="¿Eliminar trabajador?"
      message="El trabajador quedará inactivo. Podés reactivarlo luego."
      confirmLabel={busy ? 'Eliminando…' : 'Eliminar'}
      cancelLabel="Cancelar"
      onConfirm={() => void onConfirm()}
      onCancel={() => router.back()}
    />
  );
}
