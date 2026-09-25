import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface WeekNavProps {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  onCalendar: () => void;
}

export function WeekNav({ title, onPrev, onNext, onCalendar }: WeekNavProps) {
  const styles = useStyles();

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onPrev}
        style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        accessibilityLabel="Semana anterior"
        hitSlop={8}
      >
        <Text style={styles.navArrow}>‹</Text>
      </Pressable>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        onPress={onNext}
        style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
        accessibilityLabel="Semana siguiente"
        hitSlop={8}
      >
        <Text style={styles.navArrow}>›</Text>
      </Pressable>

      <Pressable
        onPress={onCalendar}
        style={({ pressed }) => [styles.calendarBtn, pressed && styles.navBtnPressed]}
        accessibilityLabel="Ir a una fecha"
        hitSlop={8}
      >
        <Text style={styles.calendarIcon}>📅</Text>
      </Pressable>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: t.spacing.xl,
    gap: t.spacing.sm,
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.control,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },
  calendarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.radius.control,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: t.spacing.xs,
    marginLeft: t.spacing.xs,
  },
  navBtnPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  navArrow: {
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textSecondary,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  calendarIcon: {
    fontSize: 18,
  },
}));
