import { useMemo } from 'react';
import { Redirect, router } from 'expo-router';
import { canManageClients } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ClientForm } from '../../../src/clients/ClientForm';
import { createClient, type ClientDraft } from '../../../src/clients/clientRepository';

export default function NewClientScreen() {
  const { profile, status, syncNow } = useAuth();
  const canManage = Boolean(profile && canManageClients(profile));

  const initialValue = useMemo<ClientDraft>(
    () => ({
      name: '',
      phone: undefined,
      notes: undefined,
    }),
    []
  );

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: ClientDraft) => {
    await createClient(profile, draft);
    await syncNow();
    router.replace('/clients');
  };

  return <ClientForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar cliente" />;
}
