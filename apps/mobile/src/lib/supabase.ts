import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const rawSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const supabaseUrl = rawSupabaseUrl?.replace(/\/+$/, '');

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const supabaseConfigurationError = !isValidSupabaseUrl(supabaseUrl)
  ? 'Falta EXPO_PUBLIC_SUPABASE_URL o no contiene una URL HTTP(S) válida.'
  : !supabaseAnonKey
    ? 'Falta EXPO_PUBLIC_SUPABASE_ANON_KEY.'
    : null;

const secureSessionStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase: SupabaseClient | null =
  supabaseConfigurationError === null
    ? createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          storage: secureSessionStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const syncEndpoint = supabaseUrl ? `${supabaseUrl}/functions/v1/sync` : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase no está configurado.');
  }

  return supabase;
}
