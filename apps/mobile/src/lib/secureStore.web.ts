import type { SecureKeyValueStore } from './secureStore';

/**
 * Implementación web: localStorage. NO es cifrado — es solo para desarrollo/
 * evaluación en el navegador. En dispositivo se usa expo-secure-store
 * (secureStore.native.ts), que sí usa el almacén seguro del sistema.
 */
const memoryFallback = new Map<string, string>();

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export const secureStore: SecureKeyValueStore = {
  getItem: async (key) => {
    if (hasLocalStorage()) return window.localStorage.getItem(key);
    return memoryFallback.get(key) ?? null;
  },
  setItem: async (key, value) => {
    if (hasLocalStorage()) window.localStorage.setItem(key, value);
    else memoryFallback.set(key, value);
  },
  removeItem: async (key) => {
    if (hasLocalStorage()) window.localStorage.removeItem(key);
    else memoryFallback.delete(key);
  },
};
