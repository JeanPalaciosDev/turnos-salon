/**
 * Contrato de almacenamiento key-value asíncrono, compartido entre plataformas.
 * En nativo lo implementa expo-secure-store; en web, localStorage.
 * Metro resuelve `secureStore.native.ts` / `secureStore.web.ts` por plataforma.
 */
export interface SecureKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/**
 * Declaración de valor para TypeScript: Metro resuelve la implementación real
 * (`secureStore.native.ts` / `secureStore.web.ts`) por plataforma en runtime.
 */
export declare const secureStore: SecureKeyValueStore;

