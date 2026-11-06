/**
 * Formateo de dinero para presentación. Los montos se almacenan como ENTEROS en
 * la unidad mínima (4500 = $45,00); el símbolo y los decimales son solo render.
 * Módulo puro, sin dependencias de React Native.
 */

/**
 * Convierte un entero en unidad mínima a texto con dos decimales y el código de
 * moneda, p. ej. formatMoney(4500, 'ARS') -> "$45,00 ARS". Usa coma decimal
 * (convención de la app, español neutro).
 */
export function formatMoney(amountMinorUnits: number, currency: string): string {
  const major = amountMinorUnits / 100;
  const text = major.toFixed(2).replace('.', ',');
  return `$${text} ${currency.trim().toUpperCase()}`;
}
