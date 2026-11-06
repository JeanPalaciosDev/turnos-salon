import { Q } from '@nozbe/watermelondb';
import {
  canRecordPayment,
  canViewPayments,
  type UserProfile,
  validatePayment,
} from '@turnos/core';
import { TABLES } from '@turnos/models';

import { generateUuidV7 } from '../auth/uuid';
import { database } from '../database';
import { PaymentModel } from '../database/models';
import { getBusinessBaseCurrency } from '../services/serviceRepository';

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

/**
 * Datos que la UI envía para registrar un cobro. El monto es entero en la unidad
 * mínima. El tipo de cambio solo se exige cuando la moneda difiere de la base del
 * negocio (lo valida validatePayment). paidAt opcional: por defecto, ahora.
 */
export type PaymentDraft = {
  appointmentId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  exchangeRate?: number;
  exchangeBaseCurrency?: string;
  paidAt?: number;
};

export class PaymentValidationError extends Error {
  constructor(readonly messages: string[]) {
    super(messages.join('\n'));
    this.name = 'PaymentValidationError';
  }
}

function getPaymentsCollection() {
  return database.get<PaymentModel>(TABLES.PAYMENTS);
}

function assertCanRecord(profile: UserProfile): void {
  if (!canRecordPayment(profile)) {
    throw new Error('Solo la cuenta owner puede registrar cobros.');
  }
}

function assertCanView(profile: UserProfile): void {
  if (!canViewPayments(profile)) {
    throw new Error('Solo la cuenta owner puede ver los cobros.');
  }
}

function assertPaymentBelongsToProfile(payment: PaymentModel, profile: UserProfile): void {
  if (payment.businessId !== profile.business_id || payment.isDeleted) {
    throw new Error('El cobro no existe o no pertenece al negocio actual.');
  }
}

/**
 * Observa los cobros activos de un turno, más recientes primero. Solo owner
 * (canViewPayments). Aislamiento por business_id en la query.
 */
export function observePaymentsForAppointment(profile: UserProfile, appointmentId: string) {
  assertCanView(profile);

  return getPaymentsCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('appointment_id', appointmentId),
      Q.where('is_deleted', false),
      Q.sortBy('paid_at', Q.desc)
    )
    .observe();
}

/** Lee una vez los cobros activos de un turno (para sumas informativas). */
export async function getPaymentsForAppointment(
  profile: UserProfile,
  appointmentId: string
): Promise<PaymentModel[]> {
  assertCanView(profile);

  return getPaymentsCollection()
    .query(
      Q.where('business_id', profile.business_id),
      Q.where('appointment_id', appointmentId),
      Q.where('is_deleted', false)
    )
    .fetch();
}

/**
 * Registra un cobro en un turno. Un turno admite varios cobros (multi-método) y
 * puede no tener ninguno; los cobros no cuadran contra ningún total. La validación
 * es intrínseca (validatePayment): monto entero > 0, método válido, moneda ISO y,
 * si difiere de la base del negocio, tipo de cambio > 0 + moneda base del cambio.
 */
export async function recordPayment(
  profile: UserProfile,
  draft: PaymentDraft
): Promise<PaymentModel> {
  assertCanRecord(profile);

  if (!draft.appointmentId) {
    throw new PaymentValidationError(['El cobro debe asociarse a un turno.']);
  }

  const baseCurrency = await getBusinessBaseCurrency(profile);
  const currency = draft.currency.trim().toUpperCase();
  const exchangeBaseCurrency = draft.exchangeBaseCurrency?.trim().toUpperCase();

  const errors = validatePayment(
    {
      amount: draft.amount,
      currency,
      method: draft.method,
      exchange_rate: draft.exchangeRate,
      exchange_base_currency: exchangeBaseCurrency,
    },
    baseCurrency
  );

  if (errors.length > 0) {
    throw new PaymentValidationError([...new Set(errors)]);
  }

  const differsFromBase = currency !== baseCurrency;
  const id = generateUuidV7();
  const paidAt = draft.paidAt ?? Date.now();

  return database.write(async () =>
    getPaymentsCollection().create((payment) => {
      // Watermelon debe usar el mismo UUID que PostgreSQL; el alta viaja en `created`.
      payment._raw.id = id;
      payment.businessId = profile.business_id;
      payment.appointmentId = draft.appointmentId;
      payment.amount = draft.amount;
      payment.currency = currency;
      payment.method = draft.method;
      // El tipo de cambio solo se persiste cuando la moneda difiere de la base.
      payment.exchangeRate = differsFromBase ? draft.exchangeRate : undefined;
      payment.exchangeBaseCurrency = differsFromBase ? exchangeBaseCurrency : undefined;
      payment.paidAt = paidAt;
      payment.isDeleted = false;
      payment.updatedAt = Date.now();
      // El servidor reemplaza este valor por su cursor autoritativo en el primer pull.
      payment.syncVersion = 0;
    })
  );
}

/**
 * Anula un cobro con soft delete (is_deleted=true). Nunca borra físicamente,
 * preservando el historial de caja. Solo owner.
 */
export async function voidPayment(
  profile: UserProfile,
  paymentId: string
): Promise<PaymentModel> {
  assertCanRecord(profile);
  const payment = await getPaymentsCollection().find(paymentId);
  assertPaymentBelongsToProfile(payment, profile);

  return database.write(async () =>
    payment.update((record) => {
      assertPaymentBelongsToProfile(record, profile);
      record.isDeleted = true;
      record.updatedAt = Date.now();
    })
  );
}
