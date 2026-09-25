import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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

  return (
    <View style={styles.bar}>
      <View style={styles.themeWrap}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => setThemeOpen((v) => !v)}
          accessibilityLabel="Tema"
        >
          <Text style={styles.brush}>🖌</Text>
        </Pressable>
        {themeOpen && <ThemePanel onClose={() => setThemeOpen(false)} />}
      </View>

      <Pressable
        style={styles.navBtn}
        onPress={() => setNavOpen(true)}
        accessibilityLabel="Menú de navegación"
      >
        <Text style={styles.dots}>●●●</Text>
      </Pressable>

      <SideNav visible={navOpen} onClose={() => setNavOpen(false)} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.xl,
  },
  themeWrap: { position: 'relative' },
  iconBtn: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: t.palette.bgSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brush: { fontSize: 12 },
  navBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  dots: { fontSize: 12, color: t.palette.textPrimary, letterSpacing: 1 },
}));
