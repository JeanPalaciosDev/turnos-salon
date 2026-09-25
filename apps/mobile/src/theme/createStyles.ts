import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useTheme, type ResolvedTheme } from './ThemeProvider';

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Factory de estilos con tema — la pieza que evita la trampa de §5.2.
 *
 * `StyleSheet.create` se evalúa UNA sola vez al importar el módulo, así que un
 * color de tema dentro de un `StyleSheet.create` de nivel de módulo NO repinta
 * al cambiar de tema. La solución: definir los estilos como una FUNCIÓN de la
 * paleta activa y crear el StyleSheet dentro de un hook memoizado por tema.
 *
 * Uso en un componente:
 *   const useStyles = createStyles((t) => ({
 *     card: { backgroundColor: t.palette.bgSurface, borderRadius: t.radius.card },
 *   }));
 *   // dentro del componente:
 *   const styles = useStyles();
 *
 * Regla dura (§5.2): NUNCA pongas un color de tema en un `StyleSheet.create`
 * de nivel de módulo. Todo estilo con color pasa por acá.
 */
export function createStyles<T extends NamedStyles<T>>(
  factory: (theme: ResolvedTheme) => T,
): () => T {
  return function useStyles(): T {
    const theme = useTheme();
    // Memoizado por identidad de la paleta (cambia cuando cambia color o modo),
    // así el StyleSheet se recomputa exactamente cuando el tema cambia.
    return useMemo(
      () => StyleSheet.create(factory(theme)),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [theme.palette, theme.mode, theme.color],
    );
  };
}

/**
 * Produce el objeto de sombra de RN a partir de una elevación (forma) + el
 * color de sombra de la paleta activa. iOS usa shadow*; Android aproxima con
 * elevation a partir del blur.
 */
export function themedShadow(
  theme: ResolvedTheme,
  key: keyof ResolvedTheme['elevation'],
) {
  const e = theme.elevation[key];
  return {
    shadowColor: theme.palette.shadowColor,
    shadowOffset: { width: 0, height: e.offsetY },
    shadowOpacity: e.opacity,
    shadowRadius: e.blur / 2,
    elevation: Math.max(1, Math.round(e.blur / 2)),
  };
}
