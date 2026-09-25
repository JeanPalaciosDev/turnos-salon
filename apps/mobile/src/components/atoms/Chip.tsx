import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}

export function Chip({ label, selected = false, onPress }: ChipProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, selected ? styles.selected : styles.unselected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  base: {
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  unselected: {
    backgroundColor: t.palette.bgSunken,
    borderColor: t.palette.borderSubtle,
  },
  selected: {
    backgroundColor: t.palette.brandPrimary,
    borderColor: t.palette.brandPrimary,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
  },
  labelUnselected: {
    color: t.palette.textSecondary,
  },
  labelSelected: {
    color: t.palette.btnPrimaryText,
  },
}));
