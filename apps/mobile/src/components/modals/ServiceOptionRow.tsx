import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles, useTheme } from '../../theme';

interface ServiceOptionRowProps {
  label: string;
  price?: string;
  duration?: string;
  selected: boolean;
  onPress: () => void;
}

/**
 * Fila de servicio con checkbox para el buscador multiselect de servicios.
 */
export function ServiceOptionRow({
  label,
  price,
  duration,
  selected,
  onPress,
}: ServiceOptionRowProps) {
  const styles = useStyles();
  const { tabularNums } = useTheme();
  const hasInfo = price !== undefined || duration !== undefined;
  const infoText = [price, duration].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
    >
      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </View>

      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {hasInfo && (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          <Text style={[styles.info, tabularNums as any]}>{infoText}</Text>
        )}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
  },
  rowPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: t.spacing.xs,
    borderWidth: 2,
    borderColor: t.palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: t.palette.brandPrimary,
    borderColor: t.palette.brandPrimary,
  },
  checkmark: {
    fontSize: 12,
    lineHeight: 16,
    color: t.palette.btnPrimaryText,
    fontWeight: '700' as const,
  },
  textBlock: {
    flex: 1,
    gap: t.spacing.xs,
  },
  label: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  info: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));
