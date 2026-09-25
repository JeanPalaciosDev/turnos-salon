import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface IconButtonProps {
  icon: string;
  onPress?: () => void;
  variant?: 'default' | 'danger';
}

export function IconButton({ icon, onPress, variant = 'default' }: IconButtonProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, variant === 'danger' && styles.iconDanger]}>{icon}</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  base: {
    width: 36,
    height: 36,
    borderRadius: t.radius.control,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: t.palette.bgSunken,
  },
  icon: {
    fontSize: 16,
    color: t.palette.textSecondary,
  },
  iconDanger: {
    color: t.palette.statusCancelledBorder,
  },
}));
