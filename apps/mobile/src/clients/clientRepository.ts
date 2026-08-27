import { Q } from '@nozbe/watermelondb';
import { canManageClients, type UserProfile, validateClient } from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { ClientModel } from '../database/models';

export type ClientDraft = {
  name: string;
  phone?: string;
  notes?: string;
};

export class ClientValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'ClientValidationError';
  }
}

function getClientsCollection() {
  return database.get<ClientModel>(TABLES.CLIENTS);
}

function assertCanManageClients(profile: UserProfile): void {
  if (!canManageClients(profile)) {
    throw new Error('Solo la cuenta owner puede administrar clientes.');
  }
}

function normalizeDraft(draft: ClientDraft): ClientDraft {
  const name = draft.name.trim();
  const phone = draft.phone?.trim();
  const notes = draft.notes?.trim();

  const errors = validateClient({ name });

  if (errors.length > 0) {
    throw new ClientValidationError([...new Set(errors)]);
  }

  return {
    name,
    // Los campos opcionales vacíos viajan como undefined para no persistir cadenas vacías.
    phone: phone && phone.length > 0 ? phone : undefined,
    notes: notes && notes.length > 0 ? notes : undefined,
  };
}

function assertClientBelongsToProfile(client: ClientModel, profile: UserProfile): void {
  if (client.businessId !== profile.business_id || client.isDeleted) {
    throw new Error('El cliente no existe o no pertenece al negocio actual.');
  }
}

function assignEditableFields(client: ClientModel, draft: ClientDraft): void {
  client.name = draft.name;
  client.phone = draft.phone;
  client.notes = draft.notes;
  client.updatedAt = Date.now();
}

/**
 * Observa los clientes activos del negocio actual, ordenados por nombre.
 * El aislamiento por business_id vive en la query y en el assert de pertenencia.
 */
export function observeClients(profile: UserProfile) {
  assertCanManageClients(profile);

  return getClientsCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('is_deleted', false),
      Q.sortBy('name', Q.asc)
    )
    .observe();
}

/**
 * Filtra LOCALMENTE por nombre (R7.1). No consulta el remoto: recibe la lista ya
 * observada y devuelve las coincidencias por substring, sin distinguir mayúsculas.
 */
export function filterClientsByName(clients: ClientModel[], term: string): ClientModel[] {
  const normalized = term.trim().toLowerCase();

  if (normalized.length === 0) {
    return clients;
  }

  return clients.filter((client) => client.name.toLowerCase().includes(normalized));
}

export async function getClient(profile: UserProfile, clientId: string): Promise<ClientModel> {
  assertCanManageClients(profile);
  const client = await getClientsCollection().find(clientId);
  assertClientBelongsToProfile(client, profile);
  return client;
}

export async function createClient(
  profile: UserProfile,
  draft: ClientDraft
): Promise<ClientModel> {
  assertCanManageClients(profile);
  const normalized = normalizeDraft(draft);
  const id = generateUuidV7();

  return database.write(async () =>
    getClientsCollection().create((client) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; no hay remote_id alternativo.
      client._raw.id = id;
      client.businessId = profile.business_id;
      client.name = normalized.name;
      client.phone = normalized.phone;
      client.notes = normalized.notes;
      client.isDeleted = false;
      client.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      client.syncVersion = 0;
    })
  );
}

export async function updateClient(
  profile: UserProfile,
  clientId: string,
  draft: ClientDraft
): Promise<ClientModel> {
  assertCanManageClients(profile);
  const normalized = normalizeDraft(draft);
  const client = await getClient(profile, clientId);

  return database.write(async () =>
    client.update((record) => {
      assertClientBelongsToProfile(record, profile);
      assignEditableFields(record, normalized);
    })
  );
}

/**
 * Baja lógica: clients no tiene is_active, la desactivación es soft delete con
 * is_deleted (nunca borrado físico, por regla de working-rules.md).
 */
export async function deleteClient(
  profile: UserProfile,
  clientId: string
): Promise<ClientModel> {
  assertCanManageClients(profile);
  const client = await getClient(profile, clientId);

  return database.write(async () =>
    client.update((record) => {
      assertClientBelongsToProfile(record, profile);
      record.isDeleted = true;
      record.updatedAt = Date.now();
    })
  );
}
