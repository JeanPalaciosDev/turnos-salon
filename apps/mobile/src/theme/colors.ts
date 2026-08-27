/**
 * Paleta de la app — ver .kiro/steering/design.md (sección 2).
 *
 * Regla dura: nunca rojo/verde saturados de semáforo. Todos los colores de
 * estado están desaturados ~30-40% para convivir en una grilla densa sin
 * gritar entre sí. Consumir siempre desde acá; no hardcodear hex en componentes.
 */

/** Neutros cálidos — base de la app. */
export const neutral = {
  /** Fondo general (lino cálido, no blanco puro). */
  bgBase: '#FBF7F2',
  /** Tarjetas, paneles, modales. */
  bgSurface: '#FFFFFF',
  /** Áreas hundidas: sidebar, celdas fuera de horario laboral. */
  bgSunken: '#F1EAE0',
  /** Líneas de grilla, separadores de columnas de profesional. */
  borderSubtle: '#E8DFD3',
  /** Bordes de inputs, tarjetas activas. */
  borderStrong: '#D8C9B8',
  /** Texto principal (marrón café, nunca negro puro). */
  textPrimary: '#3A2E28',
  /** Metadatos: hora, duración, notas. */
  textSecondary: '#7A6A5E',
  /** Placeholder, texto deshabilitado. */
  textMuted: '#A79484',
} as const;

/** Acento de marca. */
export const brand = {
  /** Botones primarios, día seleccionado, marca. */
  brandPrimary: '#8C6A56',
  /** Estado pressed/active de botón primario (web: hover). */
  brandPrimaryPressed: '#745644',
  /** Fondos suaves de elementos de marca (chips, badges neutros). */
  brandSoft: '#EDE1D3',
  /** Realce de celdas de calendario, focus/press suaves. */
  accentWarm: '#B98D6F',
} as const;

/**
 * Estados de cita — el sistema más importante de la app.
 * Cada estado se pinta como borde lateral de 3-4px (`border`) + fondo tenue
 * (`bg`) en la tarjeta, más un ícono para no depender solo del color.
 */
export const status = {
  confirmed: { border: '#6B8E7B', bg: '#EAF0EB' },
  pending: { border: '#C97B63', bg: '#F7EAE5' },
  active: { border: '#8C6A56', bg: '#F1E8DE' },
  done: { border: '#A79484', bg: '#F1EAE0' },
  cancelled: { border: '#B0453F', bg: '#F7E8E6' },
  noshow: { border: '#8B4F42', bg: '#F2E4E0' },
  /** Bloqueado/descanso: rayado diagonal sobre bgSunken (sin fondo tenue). */
  blocked: { border: '#D8C9B8', bg: neutral.bgSunken },
} as const;

/** Identificador de color por profesional (color de persona, no de estado). */
export const staffColors = [
  '#C9A9A6',
  '#A6C0C9',
  '#C9C2A6',
  '#B7A6C9',
  '#A6C9B0',
  '#C9B8A6',
] as const;

/** Overlays y sombras cálidas (marrón, nunca negro/gris frío). */
export const overlay = {
  /** Fondo de modal. */
  modalScrim: 'rgba(58,46,40,0.4)',
  /** Color base de sombra (usar con opacidad 0.08-0.15). */
  shadowColor: '#3A2E28',
} as const;

export type StatusKey = keyof typeof status;

export const colors = {
  ...neutral,
  ...brand,
  status,
  staffColors,
  overlay,
} as const;
