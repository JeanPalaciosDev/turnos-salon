/**
 * Lista estática de monedas ISO 4217 comunes para el onboarding del owner.
 * Módulo de datos puro (sin dependencias de React Native). Es la fuente de verdad:
 * el onboarding no depende de APIs de Intl que en Hermes/SDK 52 pueden no estar
 * disponibles. El fallback manual del selector cubre cualquier código no listado.
 *
 * Orden: Latam + España primero (los más probables), luego el resto.
 */
export type CurrencyOption = {
  /** Código ISO 4217 de 3 letras en mayúsculas. */
  code: string;
  /** Nombre legible en español neutro. */
  name: string;
};

export const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: 'ARS', name: 'Peso argentino' },
  { code: 'MXN', name: 'Peso mexicano' },
  { code: 'COP', name: 'Peso colombiano' },
  { code: 'CLP', name: 'Peso chileno' },
  { code: 'PEN', name: 'Sol peruano' },
  { code: 'UYU', name: 'Peso uruguayo' },
  { code: 'BRL', name: 'Real brasileño' },
  { code: 'USD', name: 'Dólar estadounidense' },
  { code: 'EUR', name: 'Euro' },
  { code: 'BOB', name: 'Boliviano' },
  { code: 'PYG', name: 'Guaraní paraguayo' },
  { code: 'VES', name: 'Bolívar venezolano' },
  { code: 'GTQ', name: 'Quetzal guatemalteco' },
  { code: 'DOP', name: 'Peso dominicano' },
  { code: 'CRC', name: 'Colón costarricense' },
  { code: 'HNL', name: 'Lempira hondureño' },
  { code: 'NIO', name: 'Córdoba nicaragüense' },
  { code: 'PAB', name: 'Balboa panameño' },
];

/** Devuelve la moneda si su código está en la lista precargada. */
export function findCurrency(code: string): CurrencyOption | undefined {
  const normalized = code.trim().toUpperCase();
  return COMMON_CURRENCIES.find((currency) => currency.code === normalized);
}
