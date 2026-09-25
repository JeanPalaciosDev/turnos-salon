import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface ColorSwatchProps {
  color: string;
  active?: boolean;
  onPress?: () => void;
}

export function ColorSwatch({ color, active = false, onPress }: ColorSwatchProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.swatch, { backgroundColor: color }, active && styles.swatchActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active && <Text style={styles.check}>✓</Text>}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: t.palette.borderStrong,
  },
  check: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
}));
