import { Q } from '@nozbe/watermelondb';
import {
  canManageWorkers,
  type CommissionRule,
  type UserProfile,
  validateCommissionRule,
  type WorkerCommissionConfig,
} from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { WorkerModel, WorkerServiceCommissionModel } from '../database/models';

export type CommissionType = 'percentage' | 'fixed_per_service';

/** Borrador que la UI envía para una regla de comisión. */
export type CommissionRuleDraft = {
  commissionType: CommissionType;
  /** Porcentaje (0–100) o monto fijo entero en la unidad mínima. */
  commissionValue: number;
  /** Solo para fixed_per_service. */
  commissionCurrency?: string;
};

export class CommissionValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'CommissionValidationError';
  }
}

function getOverridesCollection() {
  return database.get<WorkerServiceCommissionModel>(TABLES.WORKER_SERVICE_COMMISSIONS);
}

function getWorkersCollection() {
  return database.get<WorkerModel>(TABLES.WORKERS);
}

/** Las comisiones son configuración del negocio: solo la cuenta owner las administra. */
function assertCanManage(profile: UserProfile): void {
  if (!canManageWorkers(profile)) {
    throw new Error('Solo la cuenta owner puede configurar comisiones.');
  }
}

/**
 * Normaliza y valida una regla con las mismas reglas del dominio: valor entero
 * no negativo, porcentaje hasta 100 y moneda ISO obligatoria en el monto fijo.
 * El porcentaje nunca lleva moneda, para satisfacer el CHECK de consistencia.
 */
function normalizeRule(draft: CommissionRuleDraft): Required<CommissionRuleDraft> | CommissionRuleDraft {
  const commissionCurrency =
    draft.commissionType === 'fixed_per_service'
      ? draft.commissionCurrency?.trim().toUpperCase()
      : undefined;

  const errors = validateCommissionRule({
    commission_type: draft.commissionType,
    commission_value: draft.commissionValue,
    commission_currency: commissionCurrency,
  });

  if (errors.length > 0) {
    throw new CommissionValidationError([...new Set(errors)]);
  }

  return {
    commissionType: draft.commissionType,
    commissionValue: draft.commissionValue,
    commissionCurrency,
  };
}

/** Observa las excepciones por servicio de un trabajador. */
export function observeWorkerOverrides(profile: UserProfile, workerId: string) {
  assertCanManage(profile);

  return getOverridesCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('worker_id', workerId),
      Q.where('is_deleted', false)
    )
    .observe();
}

/**
 * Cambia la comisión por defecto de un trabajador. Vive en las columnas de
 * `workers`, que ya sincronizan por el push genérico, así que la edición es
 * offline-first como el resto del ABM.
 */
export async function setWorkerDefaultCommission(
  profile: UserProfile,
  workerId: string,
  draft: CommissionRuleDraft
): Promise<WorkerModel> {
  assertCanManage(profile);
  const rule = normalizeRule(draft);
  const worker = await getWorkersCollection().find(workerId);

  if (worker.businessId !== profile.business_id || worker.isDeleted) {
    throw new Error('El trabajador no existe o no pertenece al negocio actual.');
  }

  return database.write(async () =>
    worker.update((record) => {
      record.commissionType = rule.commissionType;
      record.commissionValue = rule.commissionValue;
      record.commissionCurrency = rule.commissionCurrency;
      record.updatedAt = Date.now();
    })
  );
}

/**
 * Crea o actualiza la excepción de un servicio para un trabajador. Hay una sola
 * excepción activa por par trabajador/servicio (lo garantiza el índice único del
 * servidor), así que si ya existe se reutiliza la fila en vez de crear otra.
 */
export async function setWorkerServiceCommission(
  profile: UserProfile,
  workerId: string,
  serviceId: string,
  draft: CommissionRuleDraft
): Promise<WorkerServiceCommissionModel> {
  assertCanManage(profile);
  const rule = normalizeRule(draft);

  const existing = await getOverridesCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('worker_id', workerId),
      Q.where('service_id', serviceId),
      Q.where('is_deleted', false)
    )
    .fetch();

  if (existing.length > 0) {
    const row = existing[0];
    return database.write(async () =>
      row.update((record) => {
        record.commissionType = rule.commissionType;
        record.commissionValue = rule.commissionValue;
        record.commissionCurrency = rule.commissionCurrency;
        record.updatedAt = Date.now();
      })
    );
  }

  const id = generateUuidV7();

  return database.write(async () =>
    getOverridesCollection().create((record) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; el alta viaja en `created`.
      record._raw.id = id;
      record.businessId = profile.business_id;
      record.workerId = workerId;
      record.serviceId = serviceId;
      record.commissionType = rule.commissionType;
      record.commissionValue = rule.commissionValue;
      record.commissionCurrency = rule.commissionCurrency;
      record.isDeleted = false;
      record.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      record.syncVersion = 0;
    })
  );
}

/**
 * Quita la excepción de un servicio con soft delete: el trabajador vuelve a
 * cobrar su comisión por defecto en ese servicio.
 */
export async function removeWorkerServiceCommission(
  profile: UserProfile,
  overrideId: string
): Promise<WorkerServiceCommissionModel> {
  assertCanManage(profile);
  const row = await getOverridesCollection().find(overrideId);

  if (row.businessId !== profile.business_id || row.isDeleted) {
    throw new Error('La excepción no existe o no pertenece al negocio actual.');
  }

  return database.write(async () =>
    row.update((record) => {
      record.isDeleted = true;
      record.updatedAt = Date.now();
    })
  );
}

/** Arma la configuración de comisión de dominio de un trabajador (regla + excepciones). */
export async function getWorkerCommissionConfig(
  profile: UserProfile,
  worker: Pick<WorkerModel, 'id' | 'commissionType' | 'commissionValue' | 'commissionCurrency'>,
  overrides: WorkerServiceCommissionModel[]
): Promise<WorkerCommissionConfig> {
  const byService: Record<string, CommissionRule> = {};

  for (const row of overrides) {
    if (row.workerId !== worker.id) continue;
    byService[row.serviceId] = {
      commission_type: row.commissionType,
      commission_value: row.commissionValue,
      commission_currency: row.commissionCurrency,
    };
  }

  return {
    worker_id: worker.id,
    default_rule: {
      commission_type: worker.commissionType,
      commission_value: worker.commissionValue,
      commission_currency: worker.commissionCurrency,
    },
    overrides: byService,
  };
}

/** Lee todas las excepciones activas del negocio (para el cálculo del período). */
export async function getAllOverrides(
  profile: UserProfile
): Promise<WorkerServiceCommissionModel[]> {
  return getOverridesCollection()
    .query(Q.where('business_id', profile.business_id), Q.where('is_deleted', false))
    .fetch();
}
