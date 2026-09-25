import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import {
  getPalette,
  type Palette,
  type PaletteColor,
  type PaletteMode,
} from './palettes.generated';
import { elevation, personColors, radius, spacing, tabularNums, typeScale } from './tokens';

/** Familia de color por defecto y modo por defecto (§5.1). */
const DEFAULT_COLOR: PaletteColor = 'carmelita';
const DEFAULT_MODE: PaletteMode = 'light';

/** Metadatos de cada familia para el ThemePanel (swatch = brand-primary en claro). */
export const COLOR_FAMILIES: { key: PaletteColor; label: string; swatch: string }[] = [
  { key: 'carmelita', label: 'Carmelita', swatch: '#8C6A56' },
  { key: 'morado', label: 'Morado', swatch: '#8B6FA8' },
  { key: 'azul', label: 'Azul', swatch: '#5F7FA6' },
  { key: 'rosa', label: 'Rosa', swatch: '#B5708C' },
  { key: 'verde', label: 'Verde', swatch: '#6E8F5C' },
  { key: 'amarillo', label: 'Amarillo', swatch: '#9C7830' },
  { key: 'naranja', label: 'Naranja', swatch: '#C1703C' },
];

/**
 * El tema resuelto que consumen los componentes: la paleta activa + los tokens
 * de forma (que no varían con el tema) + helpers derivados.
 */
export interface ResolvedTheme {
  mode: PaletteMode;
  color: PaletteColor;
  /** Colores de la paleta activa (carmelita-light, azul-dark, etc.). */
  palette: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typeScale: typeof typeScale;
  elevation: typeof elevation;
  personColors: typeof personColors;
  tabularNums: typeof tabularNums;
}

interface ThemeContextValue extends ResolvedTheme {
  setMode: (mode: PaletteMode) => void;
  setColor: (color: PaletteColor) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildResolvedTheme(color: PaletteColor, mode: PaletteMode): ResolvedTheme {
  return {
    mode,
    color,
    palette: getPalette(color, mode),
    spacing,
    radius,
    typeScale,
    elevation,
    personColors,
    tabularNums,
  };
}

export function ThemeProvider({
  children,
  initialColor = DEFAULT_COLOR,
  initialMode = DEFAULT_MODE,
}: {
  children: React.ReactNode;
  initialColor?: PaletteColor;
  initialMode?: PaletteMode;
}) {
  const [mode, setMode] = useState<PaletteMode>(initialMode);
  const [color, setColor] = useState<PaletteColor>(initialColor);

  const toggleMode = useCallback(
    () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...buildResolvedTheme(color, mode),
      setMode,
      setColor,
      toggleMode,
    }),
    [color, mode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Hook principal: devuelve la paleta resuelta y los setters de tema. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  }
  return ctx;
}
