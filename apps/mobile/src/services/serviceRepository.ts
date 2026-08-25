import { Q } from '@nozbe/watermelondb';
import { canManageServices, type UserProfile, validateService } from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { ServiceModel } from '../database/models';

export type ServiceDraft = {
  name: string;
  durationMinutes: number;
  defaultPriceAmount: number;
  defaultPriceCurrency: string;
};

export class ServiceValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'ServiceValidationError';
  }
}

function getServicesCollection() {
  return database.get<ServiceModel>(TABLES.SERVICES);
}

function assertCanManageServices(profile: UserProfile): void {
  if (!canManageServices(profile)) {
    throw new Error('Solo la cuenta owner puede administrar servicios.');
  }
}

function normalizeDraft(draft: ServiceDraft): ServiceDraft {
  const normalized: ServiceDraft = {
    name: draft.name.trim(),
    durationMinutes: draft.durationMinutes,
    defaultPriceAmount: draft.defaultPriceAmount,
    defaultPriceCurrency: draft.defaultPriceCurrency.trim().toUpperCase(),
  };
  const errors = validateService({
    name: normalized.name,
    duration_minutes: normalized.durationMinutes,
    default_price_amount: normalized.defaultPriceAmount,
  });

  if (!Number.isSafeInteger(normalized.durationMinutes) || normalized.durationMinutes <= 0) {
    errors.push('La duración debe ser un número entero mayor a 0.');
  }

  if (!Number.isSafeInteger(normalized.defaultPriceAmount) || normalized.defaultPriceAmount <= 0) {
    errors.push('El precio debe ser un número entero mayor a 0 en la unidad mínima.');
  }

  if (!/^[A-Z]{3}$/.test(normalized.defaultPriceCurrency)) {
    errors.push('La moneda debe usar un código ISO de tres letras, por ejemplo ARS.');
  }

  if (errors.length > 0) {
    throw new ServiceValidationError([...new Set(errors)]);
  }

  return normalized;
}

function assertServiceBelongsToProfile(service: ServiceModel, profile: UserProfile): void {
  if (service.businessId !== profile.business_id || service.isDeleted) {
    throw new Error('El servicio no existe o no pertenece al negocio actual.');
  }
}

function assignEditableFields(service: ServiceModel, draft: ServiceDraft): void {
  service.name = draft.name;
  service.durationMinutes = draft.durationMinutes;
  service.defaultPriceAmount = draft.defaultPriceAmount;
  service.defaultPriceCurrency = draft.defaultPriceCurrency;
  service.updatedAt = Date.now();
}

export function observeServices(profile: UserProfile) {
  assertCanManageServices(profile);

  return getServicesCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('is_deleted', false),
      Q.sortBy('name', Q.asc)
    )
    .observe();
}

export async function getService(profile: UserProfile, serviceId: string): Promise<ServiceModel> {
  assertCanManageServices(profile);
  const service = await getServicesCollection().find(serviceId);
  assertServiceBelongsToProfile(service, profile);
  return service;
}

export async function getBusinessBaseCurrency(profile: UserProfile): Promise<string> {
  try {
    const business = await database.get(TABLES.BUSINESS_CONFIG).find(profile.business_id);
    const currency = business._getRaw('base_currency');

    if (typeof currency === 'string' && /^[A-Z]{3}$/.test(currency)) {
      return currency;
    }
  } catch {
    // El primer pull puede no haber terminado todavía. ARS es el default remoto.
  }

  return 'ARS';
}

export async function createService(
  profile: UserProfile,
  draft: ServiceDraft
): Promise<ServiceModel> {
  assertCanManageServices(profile);
  const normalized = normalizeDraft(draft);
  const id = generateUuidV7();

  return database.write(async () =>
    getServicesCollection().create((service) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; no hay remote_id alternativo.
      service._raw.id = id;
      service.businessId = profile.business_id;
      service.name = normalized.name;
      service.durationMinutes = normalized.durationMinutes;
      service.defaultPriceAmount = normalized.defaultPriceAmount;
      service.defaultPriceCurrency = normalized.defaultPriceCurrency;
      service.isActive = true;
      service.isDeleted = false;
      service.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      service.syncVersion = 0;
    })
  );
}

export async function updateService(
  profile: UserProfile,
  serviceId: string,
  draft: ServiceDraft
): Promise<ServiceModel> {
  assertCanManageServices(profile);
  const normalized = normalizeDraft(draft);
  const service = await getService(profile, serviceId);

  return database.write(async () =>
    service.update((record) => {
      assertServiceBelongsToProfile(record, profile);
      assignEditableFields(record, normalized);
    })
  );
}

export async function setServiceActive(
  profile: UserProfile,
  serviceId: string,
  isActive: boolean
): Promise<ServiceModel> {
  assertCanManageServices(profile);
  const service = await getService(profile, serviceId);

  return database.write(async () =>
    service.update((record) => {
      assertServiceBelongsToProfile(record, profile);
      record.isActive = isActive;
      record.updatedAt = Date.now();
    })
  );
}
