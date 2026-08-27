/**
 * Espaciado, radios y sombras — ver .kiro/steering/design.md (sección 6).
 * Espaciado en base 4. Sombras siempre suaves y cálidas.
 */

import { overlay } from './colors';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  /** Inputs, botones. */
  control: 8,
  /** Tarjetas de cita (sensación de ficha física). */
  card: 12,
  /** Modales, paneles grandes. */
  panel: 16,
  /** Píldoras (badges de estado). */
  pill: 999,
} as const;

/**
 * Sombras cálidas listas para spread en un estilo de RN.
 * Nota: en Android el color de sombra queda condicionado por `elevation`;
 * mantener `elevation` bajo para no romper la calidez.
 */
export const shadow = {
  soft: {
    shadowColor: overlay.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  raised: {
    shadowColor: overlay.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;
