import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles, themedShadow, useTheme } from '../../theme';

interface StatCardProps {
  label: string;
  value: string | number;
  onPress?: () => void;
}

export function StatCard({ label, value, onPress }: StatCardProps) {
  const styles = useStyles();
  const theme = useTheme();
  const shadow = themedShadow(theme, 'card');

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, shadow, pressed && styles.cardPressed]}
      >
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, shadow]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  card: {
    backgroundColor: t.palette.bgSurface,
    borderRadius: t.radius.card,
    padding: t.spacing.lg,
    gap: t.spacing.xs,
  },
  cardPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  value: {
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textPrimary,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));
