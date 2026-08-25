import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="home" options={{ title: 'Turnos Salón' }} />
      <Stack.Screen name="services/index" options={{ title: 'Servicios' }} />
      <Stack.Screen name="services/new" options={{ title: 'Nuevo servicio' }} />
      <Stack.Screen name="services/[id]" options={{ title: 'Editar servicio' }} />
    </Stack>
  );
}
