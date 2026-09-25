/**
 * Lista estática de zonas horarias IANA comunes para el onboarding del owner.
 * Módulo de datos puro (sin dependencias de React Native).
 *
 * Decisión: NO usar Intl.supportedValuesOf('timeZone') como fuente. En Expo SDK
 * 52 / Hermes esa API no es confiable (depende de un build de Hermes con ICU
 * completo; puede lanzar TypeError o devolver un set parcial según el device).
 * La lista estática es determinística y offline-friendly; el fallback manual del
 * selector cubre cualquier zona no listada.
 */
export type TimezoneOption = {
  /** Identificador IANA válido. */
  id: string;
  /** Etiqueta legible en español neutro. */
  label: string;
};

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { id: 'America/Argentina/Buenos_Aires', label: 'Argentina (Buenos Aires)' },
  { id: 'America/Mexico_City', label: 'México (Ciudad de México)' },
  { id: 'America/Bogota', label: 'Colombia (Bogotá)' },
  { id: 'America/Santiago', label: 'Chile (Santiago)' },
  { id: 'America/Lima', label: 'Perú (Lima)' },
  { id: 'America/Montevideo', label: 'Uruguay (Montevideo)' },
  { id: 'America/Sao_Paulo', label: 'Brasil (São Paulo)' },
  { id: 'America/Caracas', label: 'Venezuela (Caracas)' },
  { id: 'America/La_Paz', label: 'Bolivia (La Paz)' },
  { id: 'America/Asuncion', label: 'Paraguay (Asunción)' },
  { id: 'America/Guatemala', label: 'Guatemala (Ciudad de Guatemala)' },
  { id: 'America/Santo_Domingo', label: 'República Dominicana (Santo Domingo)' },
  { id: 'America/Costa_Rica', label: 'Costa Rica (San José)' },
  { id: 'America/Panama', label: 'Panamá (Ciudad de Panamá)' },
  { id: 'Europe/Madrid', label: 'España (Madrid)' },
];

/** Devuelve la zona horaria si su identificador está en la lista precargada. */
export function findTimezone(id: string): TimezoneOption | undefined {
  const normalized = id.trim();
  return COMMON_TIMEZONES.find((timezone) => timezone.id === normalized);
}
