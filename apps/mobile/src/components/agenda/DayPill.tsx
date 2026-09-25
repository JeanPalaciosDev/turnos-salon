import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface DayPillProps {
  dayName: string;
  dayNumber: number;
  selected?: boolean;
  today?: boolean;
  hasTurnos?: boolean;
  onPress: () => void;
}

export function DayPill({
  dayName,
  dayNumber,
  selected = false,
  today = false,
  hasTurnos = false,
  onPress,
}: DayPillProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        selected && styles.pillSelected,
        !selected && today && styles.pillToday,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.dayName, selected && styles.dayNameSelected]}>{dayName}</Text>
      <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{dayNumber}</Text>
      {hasTurnos ? (
        <View style={[styles.dot, selected && styles.dotSelected]} />
      ) : (
        <View style={styles.dotPlaceholder} />
      )}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  pill: {
    alignItems: 'center',
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    minWidth: 44,
    borderRadius: t.radius.card,
    gap: 2,
  },
  pillSelected: {
    backgroundColor: t.palette.brandPrimary,
  },
  pillToday: {
    borderWidth: 1,
    borderColor: t.palette.brandPrimary,
  },
  dayName: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.textMuted,
  },
  dayNameSelected: {
    color: t.palette.btnPrimaryText,
  },
  dayNumber: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textSecondary,
  },
  dayNumberSelected: {
    color: t.palette.btnPrimaryText,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.palette.brandPrimary,
  },
  dotSelected: {
    backgroundColor: t.palette.btnPrimaryText,
  },
  dotPlaceholder: {
    width: 6,
    height: 6,
  },
}));
