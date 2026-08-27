/**
 * Tipografía — ver .kiro/steering/design.md (sección 3).
 *
 * Fuentes de marca: Fraunces (display/números) y Public Sans o Inter (UI).
 * Aún no se cargan con expo-font, así que `fontFamily` queda `undefined`
 * (usa la fuente del sistema) hasta que se registren. Los nombres esperados
 * están en `fontFamilies` para cablearlos cuando se agregue expo-font.
 *
 * Interlineado generoso (1.4-1.5): se lee a media distancia, no es un spreadsheet.
 */

import type { TextStyle } from 'react-native';

/**
 * Nombres de familia registrados vía expo-font en el layout raíz (ver
 * `app/_layout.tsx`). Cada peso es una familia propia porque RN no aplica de
 * forma fiable el eje `fontWeight` sobre una sola familia estática.
 * Las claves deben coincidir exactamente con las de `useFonts(...)`.
 */
export const fontFamilies = {
  /** Fraunces SemiBold — display, h2, h3 y números destacados. */
  displaySemiBold: 'Fraunces-SemiBold',
  /** Fraunces Regular — cuerpo serif ocasional. */
  displayRegular: 'Fraunces-Regular',
  /** Public Sans Regular (400) — cuerpo. */
  bodyRegular: 'PublicSans-Regular',
  /** Public Sans Medium (500) — small. */
  bodyMedium: 'PublicSans-Medium',
  /** Public Sans SemiBold (600) — labels, botones. */
  bodySemiBold: 'PublicSans-SemiBold',
} as const;

const LINE_HEIGHT_RATIO = 1.45;

function lineHeight(size: number): number {
  return Math.round(size * LINE_HEIGHT_RATIO);
}

/** Tabular nums para horas, duración y precios (deben alinear verticalmente). */
export const tabularNumbers: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};

export const typography = {
  /** Título de página. */
  display: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 28,
    fontWeight: '600',
    lineHeight: lineHeight(28),
  },
  /** Nombre de profesional (columna), fecha. */
  h2: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 20,
    fontWeight: '600',
    lineHeight: lineHeight(20),
  },
  /** Nombre de cliente en tarjeta. */
  h3: {
    fontFamily: fontFamilies.displaySemiBold,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: lineHeight(16),
  },
  /** Texto general, servicio, notas. */
  body: {
    fontFamily: fontFamilies.bodyRegular,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: lineHeight(14),
  },
  /** Labels, botones — cuerpo con énfasis (600). */
  bodyStrong: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: lineHeight(14),
  },
  /** Hora, duración, badges de estado. */
  small: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: lineHeight(12),
  },
  /** Metadatos secundarios, timestamps. */
  micro: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: lineHeight(11),
  },
} as const satisfies Record<string, TextStyle>;
