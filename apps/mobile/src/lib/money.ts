/**
 * Formateo de dinero para presentación. Los montos se almacenan como ENTEROS en
 * la unidad mínima (4500 = $45,00); el símbolo y los decimales son solo render.
 * Módulo puro, sin dependencias de React Native.
 */

/**
 * Convierte un entero en unidad mínima a texto con separador de miles, dos
 * decimales y el código de moneda: formatMoney(4500, 'ARS') -> "$45,00 ARS",
 * formatMoney(1000000, 'ARS') -> "$10.000,00 ARS". Convención del español
 * neutro: punto para los miles y coma para los decimales.
 *
 * La agrupación se hace a mano en lugar de con toLocaleString: en Hermes sin
 * ICU completo, toLocaleString('es') puede caer al formato en-US e invertir los
 * separadores ("10,000.00"), así que el resultado sería distinto en web y en
 * nativo.
 */
export function formatMoney(amountMinorUnits: number, currency: string): string {
  const isNegative = amountMinorUnits < 0;
  const [whole, decimals] = Math.abs(amountMinorUnits / 100).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = isNegative ? '-' : '';

  return `${sign}$${grouped},${decimals} ${currency.trim().toUpperCase()}`;
}
