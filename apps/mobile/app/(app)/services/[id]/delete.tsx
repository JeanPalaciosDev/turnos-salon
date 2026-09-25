import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import { setServiceActive } from '../../../../src/services/serviceRepository';
import { ConfirmModal } from '../../../../src/components/modals';

/**
 * Pantalla 8 — Confirmar eliminación de servicio (§8.6), modal.
 * Baja lógica: desactivar (is_active=false), NO borrado físico (regla de dominio).
 */
export default function ServiceDeleteModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [busy, setBusy] = useState(false);

  const onConfirm = async () => {
    if (!profile || !id) return;
    setBusy(true);
    try {
      await setServiceActive(profile, id, false);
      await syncNow();
    } finally {
      router.replace('/(app)/services');
    }
  };

  return (
    <ConfirmModal
      visible
      title="¿Eliminar servicio?"
      message="El servicio quedará inactivo. Podés reactivarlo luego."
      confirmLabel={busy ? 'Eliminando…' : 'Eliminar'}
      cancelLabel="Cancelar"
      onConfirm={() => void onConfirm()}
      onCancel={() => router.back()}
    />
  );
}
