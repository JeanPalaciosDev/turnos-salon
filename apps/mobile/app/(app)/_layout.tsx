import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="home" options={{ title: 'Turnos Salón' }} />
      <Stack.Screen name="services/index" options={{ title: 'Servicios' }} />
      <Stack.Screen name="services/new" options={{ title: 'Nuevo servicio' }} />
      <Stack.Screen name="services/[id]" options={{ title: 'Editar servicio' }} />
      <Stack.Screen name="clients/index" options={{ title: 'Clientes' }} />
      <Stack.Screen name="clients/new" options={{ title: 'Nuevo cliente' }} />
      <Stack.Screen name="clients/[id]" options={{ title: 'Editar cliente' }} />
      <Stack.Screen name="workers/index" options={{ title: 'Trabajadores' }} />
      <Stack.Screen name="workers/new" options={{ title: 'Nuevo trabajador' }} />
      <Stack.Screen name="workers/[id]" options={{ title: 'Editar trabajador' }} />
      <Stack.Screen name="appointments/index" options={{ title: 'Agenda' }} />
      <Stack.Screen name="appointments/new" options={{ title: 'Nueva cita' }} />
      <Stack.Screen name="appointments/[id]" options={{ title: 'Editar cita' }} />
    </Stack>
  );
}
