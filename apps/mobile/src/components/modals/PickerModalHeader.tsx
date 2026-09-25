import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface PickerModalHeaderProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
}

/**
 * Encabezado estándar de los modales picker (buscadores, calendar, clock).
 * Título + subtítulo opcional a la izquierda, botón × a la derecha.
 */
export function PickerModalHeader({ title, subtitle, onClose }: PickerModalHeaderProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        {subtitle !== undefined && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>
      <Pressable
        style={styles.closeBtn}
        onPress={onClose}
        hitSlop={8}
        accessibilityLabel="Cerrar"
        accessibilityRole="button"
      >
        <Text style={styles.closeIcon}>×</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingBottom: t.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
    marginBottom: t.spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: t.spacing.xs,
  },
  title: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  subtitle: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 18,
    lineHeight: 22,
    color: t.palette.textMuted,
  },
}));
