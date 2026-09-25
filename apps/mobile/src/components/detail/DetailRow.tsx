import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface DetailRowProps {
  label: string;
  value?: string;
  /** Renderiza el valor en textMuted en vez de textPrimary. */
  muted?: boolean;
  /** Contenido libre debajo del label (chips, tags, etc.). */
  children?: React.ReactNode;
}

export function DetailRow({ label, value, muted = false, children }: DetailRowProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {value !== undefined && (
        <Text style={[styles.value, muted && styles.valueMuted]}>{value}</Text>
      )}
      {children}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
    gap: t.spacing.xs,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
  value: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  valueMuted: {
    color: t.palette.textMuted,
  },
}));
