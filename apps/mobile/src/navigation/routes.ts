/**
 * Manifiesto único de rutas del side nav (§6.3).
 *
 * Agregar una pantalla al nav se hace SOLO acá — el componente SideNav no se toca.
 * Cuando llegue el sistema de roles, este es el único punto donde se filtra
 * (agregar un campo `roles?` y filtrar en SideNav).
 *
 * Splash, Login, Crear cuenta y todas las pantallas de alta/edición/detalle y
 * los modales NO van en el nav: se llega a ellas navegando desde adentro.
 */
export interface NavRoute {
  label: string;
  href: string;
  icon: string;
}

export const NAV_ROUTES: NavRoute[] = [
  { label: 'Principal (Owner)', href: '/(app)/owner', icon: '🏠' },
  { label: 'Principal (Worker)', href: '/(app)/worker', icon: '👤' },
  { label: 'Agenda semanal', href: '/(app)/agenda', icon: '📅' },
  { label: 'Servicios', href: '/(app)/services', icon: '✂️' },
  { label: 'Trabajadores', href: '/(app)/workers', icon: '💇' },
  { label: 'Clientes', href: '/(app)/clients', icon: '🧑' },
  { label: 'Cerrar sesión', href: '/(auth)/login', icon: '🚪' },
];
