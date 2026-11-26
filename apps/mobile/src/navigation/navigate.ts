import { router } from 'expo-router';

const HOME_ROUTES = ['/(app)/owner', '/(app)/worker'];

/** Vuelve a la pantalla principal limpiando la pila de navegación. */
export function goHome(role?: string): void {
  if (router.canDismiss()) {
    router.dismissAll();
    return;
  }
  router.replace(role === 'worker' ? '/(app)/worker' : '/(app)/owner');
}

/**
 * Navega a una sección desde cualquier punto sin apilar pantallas: vuelve a la
 * principal y desde ahí abre la sección, de modo que un solo "atrás" regresa al inicio.
 */
export function goToSection(href: string, role?: string): void {
  if (HOME_ROUTES.includes(href)) {
    goHome(role);
    return;
  }
  if (router.canDismiss()) {
    router.dismissAll();
  }
  router.push(href as never);
}

/** Vuelve a una pantalla ya presente en la pila (o la abre) sin duplicarla. */
export function returnTo(href: string, params?: Record<string, string>): void {
  router.dismissTo(params ? { pathname: href as never, params } : (href as never));
}
