import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { usePathname } from 'expo-router';

import { useAuth } from '../auth/AuthProvider';
import { goHome } from '../navigation/navigate';
import { createStyles } from '../theme';
import { SideNav } from './SideNav';
import { ThemePanel } from './ThemePanel';

/**
 * Header real de la app (§6.1): 🖌 a la izquierda (abre el panel de tema) y
 * ●●● a la derecha (abre el side nav). Sin barra de estado falsa — va debajo
 * del área segura (AppScreen aplica el inset).
 */
export function AppHeader() {
  const [themeOpen, setThemeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const styles = useStyles();
  const { profile } = useAuth();
  const pathname = usePathname();
  const isHome = pathname === '/owner' || pathname === '/worker';

  return (
    <View style={styles.bar}>
      <View style={styles.leftGroup}>
        <View style={styles.themeWrap}>
          <Pressable
            style={styles.iconBtn}
            onPress={() => setThemeOpen((v) => !v)}
            accessibilityLabel="Tema"
            accessibilityRole="button"
            // El botón se dibuja de 22px para no romper el diseño del header, pero
            // el área pulsable llega a 44px, que es el mínimo recomendado.
            hitSlop={6}
          >
            <Text style={styles.brush}>🖌</Text>
          </Pressable>
          {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
        </View>
        {!isHome && (
          <Pressable
            style={styles.iconBtn}
            onPress={() => goHome(profile?.role)}
            accessibilityLabel="Ir a la pantalla principal"
            accessibilityRole="button"
            hitSlop={6}
          >
            <Text style={styles.brush}>🏠</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        style={styles.navBtn}
        onPress={() => setNavOpen(true)}
        accessibilityLabel="Menú de navegación"
        accessibilityRole="button"
        hitSlop={6}
      >
        <Text style={styles.dots}>●●●</Text>
      </Pressable>

      <SideNav visible={navOpen} onClose={() => setNavOpen(false)} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  bar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.xl,
    // El header se declara arriba del cuerpo de la pantalla: AppScreen lo
    // renderiza ANTES del body, así que sin esto el contenido pintaba encima
    // del panel de tema y le robaba los clics.
    zIndex: 20,
  },
  leftGroup: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  themeWrap: { position: 'relative' },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: t.radius.control,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brush: { fontSize: 22 },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: t.radius.control,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { fontSize: 16, color: t.palette.textPrimary, letterSpacing: 2 },
}));
