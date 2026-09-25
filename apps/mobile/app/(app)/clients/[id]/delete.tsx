import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { deleteClient } from '../../../../src/clients/clientRepository';
import { ConfirmModal } from '../../../../src/components/modals';

/**
 * Confirmar eliminación de cliente, modal. clients no tiene is_active: la baja
 * es soft delete con is_deleted (nunca borrado físico, working-rules.md).
 */
export default function ClientDeleteModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (!profile || !id) return;
    setBusy(true);
    try {
      await deleteClient(profile, id);
      await syncNow();
    } finally {
      router.replace('/(app)/clients');
    }
  };

  return (
    <ConfirmModal
      visible
      title="¿Eliminar cliente?"
      message="El cliente se ocultará del listado."
      confirmLabel={busy ? 'Eliminando…' : 'Eliminar'}
      cancelLabel="Cancelar"
      onConfirm={() => void onConfirm()}
      onCancel={() => router.back()}
    />
  );
}
