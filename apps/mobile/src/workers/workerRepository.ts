import { Q } from '@nozbe/watermelondb';
import { canManageWorkers, type UserProfile, validateWorker } from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { WorkerModel } from '../database/models';

export type CommissionType = 'percentage' | 'fixed_per_service';

export type WorkerDraft = {
  name: string;
  commissionType: CommissionType;
  commissionValue: number;
  /**
   * Solo aplica a fixed_per_service. Para percentage viaja siempre como undefined
   * para satisfacer el CHECK workers_commission_currency_consistent del servidor.
   */
  commissionCurrency?: string;
};

export class WorkerValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'WorkerValidationError';
  }
}

function getWorkersCollection() {
  return database.get<WorkerModel>(TABLES.WORKERS);
}

function assertCanManageWorkers(profile: UserProfile): void {
  if (!canManageWorkers(profile)) {
    throw new Error('Solo la cuenta owner puede administrar trabajadores.');
  }
}

function normalizeDraft(draft: WorkerDraft): WorkerDraft {
  const name = draft.name.trim();
  const commissionType = draft.commissionType;
  const commissionValue = draft.commissionValue;
  // Regla de consistencia de moneda (CHECK del servidor): percentage ⇒ null;
  // fixed_per_service ⇒ moneda ISO obligatoria.
  const commissionCurrency =
    commissionType === 'fixed_per_service'
      ? draft.commissionCurrency?.trim().toUpperCase()
      : undefined;

  const errors = validateWorker({
    name,
    commission_type: commissionType,
    commission_value: commissionValue,
  });

  if (!Number.isSafeInteger(commissionValue) || commissionValue < 0) {
    errors.push('El valor de comisión debe ser un número entero de 0 o mayor.');
  }

  if (commissionType === 'percentage' && Number.isSafeInteger(commissionValue) && commissionValue > 100) {
    errors.push('El porcentaje de comisión no puede superar 100.');
  }

  if (commissionType === 'fixed_per_service') {
    if (!commissionCurrency || !/^[A-Z]{3}$/.test(commissionCurrency)) {
      errors.push('La comisión fija necesita una moneda con código ISO de tres letras, por ejemplo ARS.');
    }
  }

  if (errors.length > 0) {
    throw new WorkerValidationError([...new Set(errors)]);
  }

  return {
    name,
    commissionType,
    commissionValue,
    commissionCurrency,
  };
}

function assertWorkerBelongsToProfile(worker: WorkerModel, profile: UserProfile): void {
  if (worker.businessId !== profile.business_id || worker.isDeleted) {
    throw new Error('El trabajador no existe o no pertenece al negocio actual.');
  }
}

function assignEditableFields(worker: WorkerModel, draft: WorkerDraft): void {
  worker.name = draft.name;
  worker.commissionType = draft.commissionType;
  worker.commissionValue = draft.commissionValue;
  worker.commissionCurrency = draft.commissionCurrency;
  worker.updatedAt = Date.now();
}

/**
 * Observa los trabajadores del negocio actual (activos e inactivos), ordenados por
 * nombre. El owner ve ambos estados; la UI filtra por is_active. El aislamiento por
 * business_id vive en la query y en el assert de pertenencia.
 */
export function observeWorkers(profile: UserProfile) {
  assertCanManageWorkers(profile);

  return getWorkersCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('is_deleted', false),
      Q.sortBy('name', Q.asc)
    )
    .observe();
}

export async function getWorker(profile: UserProfile, workerId: string): Promise<WorkerModel> {
  assertCanManageWorkers(profile);
  const worker = await getWorkersCollection().find(workerId);
  assertWorkerBelongsToProfile(worker, profile);
  return worker;
}

export async function createWorker(
  profile: UserProfile,
  draft: WorkerDraft
): Promise<WorkerModel> {
  assertCanManageWorkers(profile);
  const normalized = normalizeDraft(draft);
  const id = generateUuidV7();

  return database.write(async () =>
    getWorkersCollection().create((worker) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; no hay remote_id alternativo.
      worker._raw.id = id;
      worker.businessId = profile.business_id;
      worker.name = normalized.name;
      worker.commissionType = normalized.commissionType;
      worker.commissionValue = normalized.commissionValue;
      worker.commissionCurrency = normalized.commissionCurrency;
      worker.isActive = true;
      worker.isDeleted = false;
      worker.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      worker.syncVersion = 0;
    })
  );
}

export async function updateWorker(
  profile: UserProfile,
  workerId: string,
  draft: WorkerDraft
): Promise<WorkerModel> {
  assertCanManageWorkers(profile);
  const normalized = normalizeDraft(draft);
  const worker = await getWorker(profile, workerId);

  return database.write(async () =>
    worker.update((record) => {
      assertWorkerBelongsToProfile(record, profile);
      assignEditableFields(record, normalized);
    })
  );
}

/**
 * Baja lógica principal: is_active=false. Preserva el historial de comisiones y turnos
 * (no borra), como servicios. Se usa como acción de "desactivar" en la UI.
 */
export async function setWorkerActive(
  profile: UserProfile,
  workerId: string,
  isActive: boolean
): Promise<WorkerModel> {
  assertCanManageWorkers(profile);
  const worker = await getWorker(profile, workerId);

  return database.write(async () =>
    worker.update((record) => {
      assertWorkerBelongsToProfile(record, profile);
      record.isActive = isActive;
      record.updatedAt = Date.now();
    })
  );
}

/**
 * Ocultamiento definitivo con soft delete (is_deleted). Reservado para casos
 * excepcionales; la acción habitual de baja es setWorkerActive(false).
 */
export async function deleteWorker(
  profile: UserProfile,
  workerId: string
): Promise<WorkerModel> {
  assertCanManageWorkers(profile);
  const worker = await getWorker(profile, workerId);

  return database.write(async () =>
    worker.update((record) => {
      assertWorkerBelongsToProfile(record, profile);
      record.isDeleted = true;
      record.updatedAt = Date.now();
    })
  );
}
