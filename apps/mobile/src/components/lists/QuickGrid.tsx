import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles, themedShadow, useTheme } from '../../theme';

interface QuickGridItem {
  label: string;
  icon: string;
  onPress: () => void;
}

interface QuickGridProps {
  items: QuickGridItem[];
}

export function QuickGrid({ items }: QuickGridProps) {
  const styles = useStyles();
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [
            styles.cell,
            { ...themedShadow(theme, 'card') },
            pressed && styles.cellPressed,
          ]}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
  },
  cell: {
    width: '48%',
    backgroundColor: t.palette.bgSurface,
    borderRadius: t.radius.card,
    padding: t.spacing.lg,
    gap: t.spacing.sm,
    alignItems: 'center',
  },
  cellPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  icon: {
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center',
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textPrimary,
    textAlign: 'center',
  },
}));
