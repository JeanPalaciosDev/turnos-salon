/**
 * Tokens de diseño que NO varían con el tema (o solo definen forma, no color de marca).
 * Fuente: CSS y §5.3 del README de rediseño. Los colores que SÍ varían por tema
 * viven en palettes.generated.ts.
 */

/** Espaciado base 4. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Radios: controles / tarjetas / modales-paneles / píldoras. */
export const radius = {
  control: 8,
  card: 12,
  modal: 16,
  pill: 999,
} as const;

/**
 * Familias de fuente cargadas en _layout.tsx con expo-font.
 * Fraunces para display/números; Public Sans para UI.
 */
export const fontFamily = {
  displayRegular: 'Fraunces-Regular',
  displaySemiBold: 'Fraunces-SemiBold',
  bodyRegular: 'PublicSans-Regular',
  bodyMedium: 'PublicSans-Medium',
  bodySemiBold: 'PublicSans-SemiBold',
} as const;

/**
 * Escala tipográfica (§5.3). size/weight/lineHeight.
 * display y los números usan Fraunces; el resto Public Sans.
 * Horas/duraciones/precios se renderizan con fontVariant: ['tabular-nums'].
 */
export const typeScale = {
  display: { fontSize: 28, lineHeight: 41, fontFamily: fontFamily.displaySemiBold },
  h2: { fontSize: 20, lineHeight: 29, fontFamily: fontFamily.displaySemiBold },
  h3: { fontSize: 16, lineHeight: 23, fontFamily: fontFamily.bodySemiBold },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fontFamily.bodyRegular },
  small: { fontSize: 12, lineHeight: 17, fontFamily: fontFamily.bodyMedium },
  micro: { fontSize: 11, lineHeight: 16, fontFamily: fontFamily.bodyMedium },
} as const;

/** Números tabulares para alinear horas, duraciones y precios en vertical. */
export const tabularNums = { fontVariant: ['tabular-nums'] as const };

/**
 * Colores de persona (puntos en las filas de la agenda). No tienen variante
 * oscura en el diseño: son los mismos en claro y oscuro (§5.1, confirmado en el CSS).
 */
export const personColors = ['#C9A9A6', '#A6C0C9', '#C9C2A6'] as const;

/**
 * Sombras cálidas, siempre sobre el color de sombra de la paleta activa
 * (--shadow-color), opacidad 0.08-0.15. Estas son las formas; el color lo
 * aplica la factory de estilos sobre la paleta.
 */
export const elevation = {
  card: { offsetY: 2, blur: 8, opacity: 0.08 },
  fab: { offsetY: 4, blur: 12, opacity: 0.15 },
  panel: { offsetY: 8, blur: 20, opacity: 0.18 },
  modal: { offsetY: -4, blur: 12, opacity: 0.15 },
} as const;

export type SpacingKey = keyof typeof spacing;
export type RadiusKey = keyof typeof radius;
export type TypeScaleKey = keyof typeof typeScale;
