import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '../src/auth/AuthProvider';
import { database } from '../src/database';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'Fraunces-SemiBold': require('../assets/fonts/Fraunces-SemiBold.ttf'),
    'Fraunces-Regular': require('../assets/fonts/Fraunces-Regular.ttf'),
    'PublicSans-Regular': require('../assets/fonts/PublicSans-Regular.ttf'),
    'PublicSans-Medium': require('../assets/fonts/PublicSans-Medium.ttf'),
    'PublicSans-SemiBold': require('../assets/fonts/PublicSans-SemiBold.ttf'),
  });

  // Esperar a que las fuentes carguen para evitar el salto de tipografía.
  // Si fallan, seguimos igual con la fuente del sistema en vez de bloquear la app.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <DatabaseProvider database={database}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(app)" />
        </Stack>
      </DatabaseProvider>
    </AuthProvider>
  );
}
