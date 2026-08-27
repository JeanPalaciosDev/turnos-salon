/**
 * Tema de la app — fuente de verdad de la identidad visual.
 * Ver .kiro/steering/design.md. Consumir siempre desde acá, no hardcodear valores.
 */

export * from './colors';
export * from './spacing';
export * from './typography';

import { colors } from './colors';
import { radius, shadow, spacing } from './spacing';
import { typography } from './typography';

export const theme = {
  colors,
  spacing,
  radius,
  shadow,
  typography,
} as const;

export type Theme = typeof theme;
