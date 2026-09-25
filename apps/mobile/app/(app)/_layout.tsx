import { Stack } from 'expo-router';

/**
 * Layout del grupo (app) — registra las 22 rutas internas (§7).
 * Los 9 modales usan presentation: 'modal' (overlay sobre la pantalla padre).
 * El header propio de la app lo dibuja AppScreen; aquí ocultamos el nativo.
 */
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Principales */}
      <Stack.Screen name="owner" />
      <Stack.Screen name="worker" />
      <Stack.Screen name="agenda" />

      {/* Servicios */}
      <Stack.Screen name="services/index" />
      <Stack.Screen name="services/new" />
      <Stack.Screen name="services/[id]/edit" />
      <Stack.Screen name="services/[id]/delete" options={{ presentation: 'modal' }} />

      {/* Trabajadores */}
      <Stack.Screen name="workers/index" />
      <Stack.Screen name="workers/new" />
      <Stack.Screen name="workers/[id]/edit" />
      <Stack.Screen name="workers/[id]/delete" options={{ presentation: 'modal' }} />

      {/* Clientes */}
      <Stack.Screen name="clients/index" />
      <Stack.Screen name="clients/new" />
      <Stack.Screen name="clients/[id]/edit" />
      <Stack.Screen name="clients/[id]/delete" options={{ presentation: 'modal' }} />

      {/* Turnos */}
      <Stack.Screen name="appointments/[id]/index" />
      <Stack.Screen name="appointments/new" />
      <Stack.Screen name="appointments/[id]/edit" />
      <Stack.Screen name="appointments/[id]/delete" options={{ presentation: 'modal' }} />
      <Stack.Screen name="appointments/pick-date" options={{ presentation: 'modal' }} />
      <Stack.Screen name="appointments/pick-time" options={{ presentation: 'modal' }} />
      <Stack.Screen name="appointments/pick-services" options={{ presentation: 'modal' }} />
      <Stack.Screen name="appointments/pick-client" options={{ presentation: 'modal' }} />
      <Stack.Screen name="appointments/pick-worker" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
