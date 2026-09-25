import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface PickerCreateRowProps {
  label: string;
  onPress: () => void;
}

/**
 * Fila "Crear nuevo X" — siempre primera en la lista de un picker.
 * Ícono + en círculo con color de marca.
 */
export function PickerCreateRow({ label, onPress }: PickerCreateRowProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.iconCircle}>
        <Text style={styles.iconPlus}>+</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
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
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: t.palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlus: {
    fontSize: 18,
    lineHeight: 22,
    color: t.palette.brandPrimary,
    fontWeight: '600' as const,
  },
  label: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.brandPrimary,
  },
}));
