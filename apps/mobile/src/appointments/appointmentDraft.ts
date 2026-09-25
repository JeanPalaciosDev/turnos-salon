import { useEffect, useState } from 'react';

/**
 * Store del BORRADOR de turno en curso, compartido entre la pantalla de
 * Nuevo/Editar turno y los modales buscadores (pick-client, pick-worker,
 * pick-services, pick-date, pick-time). Expo Router no devuelve datos con
 * router.back(), así que los modales escriben acá y la pantalla de turno lee.
 *
 * Es estado de UI efímero (no persiste, no toca la base): se limpia al abrir
 * un turno nuevo. Un módulo singleton + suscripción simple alcanza; no hace
 * falta una librería de estado.
 */
export interface AppointmentDraftState {
  clientId?: string;
  clientName?: string;
  workerId?: string; // undefined = "Sin asignar"
  workerName?: string;
  serviceIds: string[];
  serviceNames: string[];
  date?: string; // "YYYY-MM-DD"
  time?: string; // "HH:mm"
}

const EMPTY: AppointmentDraftState = { serviceIds: [], serviceNames: [] };

let state: AppointmentDraftState = { ...EMPTY };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function resetAppointmentDraft(initial?: Partial<AppointmentDraftState>) {
  state = { ...EMPTY, ...initial, serviceIds: initial?.serviceIds ?? [], serviceNames: initial?.serviceNames ?? [] };
  emit();
}

export function patchAppointmentDraft(patch: Partial<AppointmentDraftState>) {
  state = { ...state, ...patch };
  emit();
}

export function getAppointmentDraft(): AppointmentDraftState {
  return state;
}

/** Hook que re-renderiza el componente cuando cambia el borrador. */
export function useAppointmentDraft(): AppointmentDraftState {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
