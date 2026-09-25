/**
 * Tema de la app — fuente de verdad de la identidad visual.
 * Ver .kiro/steering/design.md y el README de rediseño (§5).
 *
 * Sistema NUEVO (conmutable en caliente): usar SIEMPRE en código nuevo.
 *   - <ThemeProvider> en el root (app/_layout.tsx).
 *   - useTheme() para leer la paleta activa y cambiar mode/color.
 *   - createStyles((t) => ({...})) para todo estilo con color (§5.2).
 *
 * La capa de compat de abajo (`colors`/`spacing`/`typography`/`theme`) es
 * TEMPORAL: la consumen las pantallas viejas de app/ que se reemplazan en la
 * Fase 4. NO usarla en código nuevo. Se elimina cuando la última pantalla vieja
 * se haya reescrito.
 */

// --- Sistema nuevo (conmutable) ---
export {
  ThemeProvider,
  useTheme,
  COLOR_FAMILIES,
  type ResolvedTheme,
} from './ThemeProvider';
export { createStyles, themedShadow } from './createStyles';
export {
  getPalette,
  PALETTES,
  PALETTE_COLORS,
  PALETTE_MODES,
  type Palette,
  type PaletteColor,
  type PaletteMode,
  type PaletteToken,
} from './palettes.generated';
// Tokens nuevos que NO colisionan con la capa de compat. `spacing` y `radius`
// nuevos se consumen vía useTheme().spacing / .radius (o import directo de
// './tokens'), para no chocar con los homónimos deprecados de abajo que las
// pantallas viejas todavía usan con su forma antigua.
export {
  fontFamily,
  typeScale,
  tabularNums,
  personColors,
  elevation,
  type SpacingKey,
  type RadiusKey,
  type TypeScaleKey,
} from './tokens';

// --- Capa de compat DEPRECADA (pantallas viejas, se borra en Fase 4) ---
/** @deprecated Usar useTheme().palette. Solo para pantallas viejas de app/. */
export * from './colors';
/** @deprecated Usar los tokens de './tokens'. Solo para pantallas viejas. */
export * from './spacing';
/** @deprecated Usar useTheme().typeScale. Solo para pantallas viejas. */
export * from './typography';

import { colors } from './colors';
import { radius as legacyRadius, shadow, spacing as legacySpacing } from './spacing';
import { typography } from './typography';

/** @deprecated Objeto plano no conmutable. Migrar a useTheme() + createStyles(). */
export const theme = {
  colors,
  spacing: legacySpacing,
  radius: legacyRadius,
  shadow,
  typography,
} as const;

/** @deprecated */
export type Theme = typeof theme;
