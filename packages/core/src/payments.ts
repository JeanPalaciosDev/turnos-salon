import type { PaymentMethod } from './types';

const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'card', 'transfer', 'other'];

/**
 * Datos intrínsecos de un pago a validar. Forma plana (igual que persiste el
 * repositorio): monto entero en unidad mínima + moneda del pago. El tipo de
 * cambio solo es obligatorio cuando la moneda del pago difiere de la base.
 */
export type PaymentInput = {
  amount?: number;
  currency?: string;
  method?: string;
  exchange_rate?: number;
  exchange_base_currency?: string;
};

/**
 * Valida un pago de forma INTRÍNSECA: no cruza contra el precio del turno ni
 * contra otros pagos. Un turno puede tener cero pagos y los pagos no cuadran
 * contra ningún total. Reglas: monto entero > 0 (unidad mínima), método válido,
 * moneda ISO de 3 letras; si la moneda del pago difiere de la base del negocio,
 * exige tipo de cambio > 0 y la moneda base del cambio.
 */
export function validatePayment(data: PaymentInput, baseCurrency: string): string[] {
  const errors: string[] = [];

  if (data.amount == null || !Number.isSafeInteger(data.amount) || data.amount <= 0) {
    errors.push('El monto debe ser un entero mayor a 0 en la unidad mínima');
  }

  if (!data.method || !PAYMENT_METHODS.includes(data.method as PaymentMethod)) {
    errors.push('El método de pago debe ser efectivo, tarjeta, transferencia u otro');
  }

  const currency = data.currency?.trim().toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    errors.push('La moneda debe usar un código ISO de tres letras, por ejemplo ARS');
  }

  const base = baseCurrency.trim().toUpperCase();
  const differsFromBase = Boolean(currency && /^[A-Z]{3}$/.test(currency) && currency !== base);

  if (differsFromBase) {
    if (data.exchange_rate == null || !(data.exchange_rate > 0)) {
      errors.push('Un pago en moneda distinta a la base necesita un tipo de cambio mayor a 0');
    }
    const exchangeBase = data.exchange_base_currency?.trim().toUpperCase();
    if (!exchangeBase || !/^[A-Z]{3}$/.test(exchangeBase)) {
      errors.push('Un pago en moneda distinta a la base necesita la moneda base del tipo de cambio');
    }
  }

  return errors;
}

/**
 * Suma informativa de lo recaudado en un turno, convertido a la moneda base con
 * el tipo de cambio congelado de cada pago. Es solo un dato ("recaudado"), nunca
 * una restricción: no se compara contra ningún total. Ignora pagos anulados
 * (is_deleted). Un pago en la moneda base aporta su monto tal cual; uno en otra
 * moneda aporta amount * exchange_rate (redondeado a entero de la unidad mínima).
 */
export function sumCollectedInBaseCurrency(
  payments: {
    amount: number;
    currency: string;
    exchange_rate?: number;
    is_deleted?: boolean;
  }[],
  baseCurrency: string
): number {
  const base = baseCurrency.trim().toUpperCase();

  return payments.reduce((total, payment) => {
    if (payment.is_deleted) {
      return total;
    }
    const currency = payment.currency.trim().toUpperCase();
    if (currency === base) {
      return total + payment.amount;
    }
    const rate = payment.exchange_rate ?? 0;
    return total + Math.round(payment.amount * rate);
  }, 0);
}
