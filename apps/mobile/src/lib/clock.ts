import { DateTime } from 'luxon';

/**
 * Helpers de fecha y hora resueltos en la zona horaria del negocio
 * (business_config.timezone), no en la del dispositivo. Módulo puro: recibe la
 * zona como parámetro y no accede a la base ni a React. Quien lo llama lee la
 * zona del negocio y la pasa; sin zona, cae a la del dispositivo (comportamiento
 * previo) para no romper antes de que el primer pull traiga business_config.
 *
 * Luxon resuelve zonas IANA (America/Mexico_City, etc.) de forma fiable, a
 * diferencia de Intl en Hermes/SDK 52.
 */

function at(timeZone?: string): DateTime {
  const now = DateTime.now();
  return timeZone ? now.setZone(timeZone) : now;
}

/** Fecha de "hoy" en la zona del negocio, en ISO "YYYY-MM-DD". */
export function todayIso(timeZone?: string): string {
  return at(timeZone).toFormat('yyyy-LL-dd');
}

/** Hora actual en la zona del negocio, en "HH:mm" (24h). */
export function nowHm(timeZone?: string): string {
  return at(timeZone).toFormat('HH:mm');
}

/** Índice del día de la semana en la zona del negocio: 0 = domingo, 6 = sábado. */
export function weekdayIndex(timeZone?: string): number {
  return at(timeZone).weekday % 7;
}

/** Convierte un Date local a ISO "YYYY-MM-DD" por sus componentes de calendario. */
export function dateToIso(date: Date): string {
  return DateTime.fromJSDate(date).toFormat('yyyy-LL-dd');
}

/** Domingo de la semana que contiene `date`, como Date a medianoche local. */
export function startOfWeek(date: Date): Date {
  const dt = DateTime.fromJSDate(date).startOf('day');
  return dt.minus({ days: dt.weekday % 7 }).toJSDate();
}

/** Suma `days` días a `date`, devolviendo un Date a medianoche local. */
export function addDays(date: Date, days: number): Date {
  return DateTime.fromJSDate(date).startOf('day').plus({ days }).toJSDate();
}
