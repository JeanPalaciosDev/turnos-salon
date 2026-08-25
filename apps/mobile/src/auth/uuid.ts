import 'react-native-get-random-values';

function randomHex(length: number): string {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new Error('No hay un generador criptográficamente seguro disponible para crear IDs.');
  }

  const bytes = new Uint8Array(Math.ceil(length / 2));
  cryptoApi.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, length);
}

/**
 * Genera un UUID v7 timestamp-sortable sin depender de una librería adicional.
 * El timestamp ocupa los primeros 48 bits y el resto usa aleatoriedad segura.
 */
export function generateUuidV7(): string {
  const timestamp = Date.now().toString(16).padStart(12, '0').slice(-12);
  // Se usan 19 nibbles fuente: uno aporta los dos bits aleatorios del variant.
  const random = randomHex(19);
  const variant = (8 + (Number.parseInt(random.charAt(3), 16) & 0x03)).toString(16);

  return [
    timestamp.slice(0, 8),
    timestamp.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(7, 19),
  ].join('-');
}
