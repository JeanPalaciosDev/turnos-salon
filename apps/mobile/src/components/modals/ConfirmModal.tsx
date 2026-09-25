import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { Button } from '../atoms';
import { ModalPanel } from './ModalPanel';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal de confirmación reutilizable para eliminar servicio, trabajador,
 * cliente o turno. Solo cambia el copy.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const styles = useStyles();

  return (
    <ModalPanel visible={visible} onClose={onCancel}>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Button variant="danger-ghost" label={confirmLabel} onPress={onConfirm} />
          <Button variant="secondary" label={cancelLabel} onPress={onCancel} />
        </View>
      </View>
    </ModalPanel>
  );
}

const useStyles = createStyles((t) => ({
  content: {
    gap: t.spacing.lg,
  },
  title: {
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textPrimary,
  },
  message: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
  },
  actions: {
    gap: t.spacing.sm,
  },
}));
