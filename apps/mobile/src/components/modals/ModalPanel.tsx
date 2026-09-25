import React from 'react';
import { Pressable, View } from 'react-native';

import { createStyles, themedShadow } from '../../theme';

interface ModalPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Base de los modales-buscadores. NO usa el <Modal> de react-native porque estos
 * componentes se renderizan dentro de rutas de Expo Router ya presentadas con
 * `presentation: 'modal'` — envolverlas en otro <Modal> produce doble modal y,
 * en web, un conflicto de foco/aria-hidden que rompe la interacción. Acá es solo
 * un overlay + panel inferior (bottom sheet) con Views normales; el "modal" lo
 * da la ruta.
 */
export function ModalPanel({ visible, onClose, children }: ModalPanelProps) {
  const styles = useStyles();

  if (!visible) return null;

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
        {children}
      </Pressable>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: t.palette.overlayModal,
  },
  panel: {
    backgroundColor: t.palette.bgSurface,
    borderTopLeftRadius: t.radius.modal,
    borderTopRightRadius: t.radius.modal,
    maxHeight: '80%',
    paddingTop: t.spacing.xl,
    paddingHorizontal: t.spacing.xl,
    paddingBottom: t.spacing.xxl,
    ...themedShadow(t, 'modal'),
  },
}));
