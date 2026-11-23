import React from 'react';
import { Modal, Platform, Pressable } from 'react-native';

import { createStyles, themedShadow } from '../../theme';

interface ModalPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Base de los modales-buscadores: overlay + panel inferior (bottom sheet).
 * En nativo se monta en un <Modal> de react-native para cubrir toda la pantalla
 * sin depender del contenedor padre; en web usa Views normales porque un <Modal>
 * anidado en una ruta modal rompe el foco/aria-hidden.
 */
export function ModalPanel({ visible, onClose, children }: ModalPanelProps) {
  const styles = useStyles();

  if (!visible) return null;

  const sheet = (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
        {children}
      </Pressable>
    </Pressable>
  );

  if (Platform.OS === 'web') return sheet;

  return (
    <Modal transparent animationType="fade" statusBarTranslucent visible onRequestClose={onClose}>
      {sheet}
    </Modal>
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
