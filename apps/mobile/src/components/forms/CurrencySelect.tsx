import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface CurrencySelectProps {
  value: string;
  onPress: () => void;
}

export function CurrencySelect({ value, onPress }: CurrencySelectProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
      accessibilityRole="button"
    >
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: t.palette.bgSunken,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    gap: t.spacing.xs,
  },
  pillPressed: {
    backgroundColor: t.palette.borderSubtle,
  },
  value: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textPrimary,
  },
  chevron: {
    fontSize: 14,
    lineHeight: 18,
    color: t.palette.textMuted,
  },
}));
