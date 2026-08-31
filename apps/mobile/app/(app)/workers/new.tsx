import { useMemo } from 'react';
import { Redirect, router } from 'expo-router';
import { canManageWorkers } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { WorkerForm } from '../../../src/workers/WorkerForm';
import { createWorker, type WorkerDraft } from '../../../src/workers/workerRepository';

export default function NewWorkerScreen() {
  const { profile, status, syncNow } = useAuth();
  const canManage = Boolean(profile && canManageWorkers(profile));

  const initialValue = useMemo<WorkerDraft>(
    () => ({
      name: '',
      commissionType: 'percentage',
      commissionValue: 0,
      commissionCurrency: undefined,
    }),
    []
  );

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: WorkerDraft) => {
    await createWorker(profile, draft);
    await syncNow();
    router.replace('/workers');
  };

  return (
    <WorkerForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar trabajador" />
  );
}
