import React, { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';

import { createStyles } from '../../theme';

interface ToggleSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleSwitch({ value, onValueChange }: ToggleSwitchProps) {
  const styles = useStyles();
  const translateX = useRef(new Animated.Value(value ? 20 : 0)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 20 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [value, translateX]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={[styles.track, value ? styles.trackOn : styles.trackOff]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  track: {
    width: 44,
    height: 24,
    borderRadius: t.radius.pill,
    padding: 2,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: t.palette.brandPrimary,
  },
  trackOff: {
    backgroundColor: t.palette.borderSubtle,
  },
  knob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
}));
