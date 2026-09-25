import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { secureStore } from './secureStore';

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
  getItem: (key: string) => secureStore.getItem(key),
  setItem: (key: string, value: string) => secureStore.setItem(key, value),
  removeItem: (key: string) => secureStore.removeItem(key),
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

export const validateSlotEndpoint = supabaseUrl
  ? `${supabaseUrl}/functions/v1/validate-slot`
  : null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(supabaseConfigurationError ?? 'Supabase no está configurado.');
  }

  return supabase;
}
