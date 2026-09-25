import * as SecureStore from 'expo-secure-store';

import type { SecureKeyValueStore } from './secureStore';

/** Implementación nativa: expo-secure-store (Keychain/Keystore). */
export const secureStore: SecureKeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
