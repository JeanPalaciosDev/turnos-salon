import React from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLOR_FAMILIES, createStyles, useTheme } from '../theme';

/**
 * Panel de tema (§6.2): fila de modos Claro/Oscuro + grilla de 7 swatches,
 * el activo con ✓. Se muestra como popover bajo el 🖌 del header.
 */
export function ThemePanel({ onClose }: { onClose?: () => void }) {
  const { mode, color, setMode, setColor } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const panel = (
    <View style={[styles.panel, Platform.OS !== 'web' && { top: insets.top + 36, left: 20 }]}>
      <View style={styles.modes}>
        <Pressable
          style={[styles.mode, mode === 'light' && styles.modeActive]}
          onPress={() => setMode('light')}
        >
          <Text style={[styles.modeText, mode === 'light' && styles.modeTextActive]}>Claro</Text>
        </Pressable>
        <Pressable
          style={[styles.mode, mode === 'dark' && styles.modeActive]}
          onPress={() => setMode('dark')}
        >
          <Text style={[styles.modeText, mode === 'dark' && styles.modeTextActive]}>Oscuro</Text>
        </Pressable>
      </View>
      <View style={styles.swatches}>
        {COLOR_FAMILIES.map((fam) => {
          const active = fam.key === color;
          return (
            <Pressable
              key={fam.key}
              style={[styles.swatch, { backgroundColor: fam.swatch }, active && styles.swatchActive]}
              onPress={() => {
                setColor(fam.key);
                onClose?.();
              }}
              accessibilityLabel={fam.label}
            >
              {active && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  if (Platform.OS === 'web') return panel;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar panel de tema" />
      {panel}
    </Modal>
  );
}

const useStyles = createStyles((t) => ({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  panel: {
    position: 'absolute',
    top: 26,
    // Se abre hacia la derecha: el 🖌 que lo ancla mide 22px y vive en el borde
    // izquierdo del header, así que con `right: 0` el panel de 184px quedaba
    // fuera de la pantalla y sus opciones eran inalcanzables.
    left: 0,
    backgroundColor: t.palette.bgSurface,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.card,
    padding: 10,
    width: 184,
    zIndex: 30,
    shadowColor: t.palette.shadowColor,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: t.elevation.panel.opacity,
    shadowRadius: 10,
    elevation: 10,
  },
  modes: {
    flexDirection: 'row',
    backgroundColor: t.palette.bgSunken,
    borderRadius: t.radius.control,
    padding: 3,
    gap: 3,
    marginBottom: 8,
  },
  mode: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  modeActive: {
    backgroundColor: t.palette.bgSurface,
    shadowColor: t.palette.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  modeText: {
    fontSize: 11,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  modeTextActive: { color: t.palette.textPrimary },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: t.palette.brandPrimary,
  },
  check: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
}));
