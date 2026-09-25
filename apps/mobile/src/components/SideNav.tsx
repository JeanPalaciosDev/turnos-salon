import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { NAV_ROUTES } from '../navigation/routes';
import { createStyles, useTheme } from '../theme';

/**
 * Side nav (§6.3): overlay que cierra al tocar afuera + panel con header
 * "Pantallas" y ×, lista de enlaces del manifiesto que cierran al elegir.
 * El último ítem ("Cerrar sesión", href /(auth)/login) dispara signOut real.
 */
export function SideNav({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const styles = useStyles();

  if (!visible) return null;

  const go = (href: string) => {
    // Navegar ANTES de cerrar: onClose() desmonta el SideNav (visible=false → null)
    // y en RN-web ese desmontaje sincrónico cancela el router.push pendiente si se
    // llama primero. Se dispara la navegación y luego se cierra el panel.
    if (href === '/(auth)/login') {
      // Cierre de sesión real: signOut resetea la base local; el splash enruta.
      void signOut().finally(() => router.replace('/'));
      onClose();
      return;
    }
    router.push(href as never);
    onClose();
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <Text style={styles.title}>Pantallas</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={styles.close}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list}>
          {NAV_ROUTES.map((route) => (
            <Pressable key={route.href} style={styles.link} onPress={() => go(route.href)}>
              <Text style={styles.linkIcon}>{route.icon}</Text>
              <Text style={styles.linkLabel}>{route.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.palette.overlayModal,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  panel: {
    width: 240,
    height: '100%',
    backgroundColor: t.palette.bgSurface,
    shadowColor: t.palette.shadowColor,
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  title: {
    fontFamily: t.typeScale.h2.fontFamily,
    fontSize: 17,
    color: t.palette.textPrimary,
  },
  close: { fontSize: 18, color: t.palette.textMuted, paddingHorizontal: 6, paddingVertical: 2 },
  list: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 18, gap: 2 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: t.radius.control,
  },
  linkIcon: { fontSize: 15, width: 18, textAlign: 'center' },
  linkLabel: {
    fontSize: 13,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textPrimary,
  },
}));
