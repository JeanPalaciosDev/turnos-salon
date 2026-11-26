import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface BackArrowProps {
  onPress?: () => void;
}

export function BackArrow({ onPress }: BackArrowProps) {
  const router = useRouter();
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      accessibilityLabel="Volver"
      accessibilityRole="button"
    >
      <Text style={styles.arrow}>←</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  base: {
    width: 44,
    height: 44,
    borderRadius: t.radius.control,
    backgroundColor: t.palette.bgSunken,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: t.palette.borderSubtle,
  },
  arrow: {
    fontSize: 24,
    color: t.palette.textPrimary,
    lineHeight: 24,
  },
}));
