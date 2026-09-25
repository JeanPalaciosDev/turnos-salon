import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { Avatar } from '../atoms';

interface PickerOptionRowProps {
  label: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  avatar?: { name: string; colorIndex?: number };
}

/**
 * Fila de opción con radio button para buscadores de clientes y trabajadores.
 * Cuando no hay avatar (caso "Sin asignar") muestra solo el label.
 */
export function PickerOptionRow({
  label,
  subtitle,
  selected,
  onPress,
  avatar,
}: PickerOptionRowProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>

      {avatar !== undefined && (
        <Avatar name={avatar.name} size={32} colorIndex={avatar.colorIndex ?? 0} />
      )}

      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {subtitle !== undefined && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
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
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.palette.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: t.palette.brandPrimary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: t.palette.brandPrimary,
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
  subtitle: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));
