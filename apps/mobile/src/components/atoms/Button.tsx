import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles, themedShadow } from '../../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'danger-ghost';

interface ButtonProps {
  variant: ButtonVariant;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

export function Button({ variant, label, onPress, disabled = false }: ButtonProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'primary' && pressed && styles.primaryPressed,
        variant === 'secondary' && styles.secondary,
        variant === 'secondary' && pressed && styles.secondaryPressed,
        variant === 'danger-ghost' && styles.dangerGhost,
        variant === 'danger-ghost' && pressed && styles.dangerGhostPressed,
        disabled && styles.disabled,
      ]}
    >
      {({ pressed }) => (
        <Text
          style={[
            styles.label,
            variant === 'primary' && styles.labelPrimary,
            variant === 'secondary' && styles.labelSecondary,
            variant === 'danger-ghost' && styles.labelDanger,
            variant === 'danger-ghost' && pressed && styles.labelDangerPressed,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: t.radius.control,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
  },
  primary: {
    backgroundColor: t.palette.brandPrimary,
    ...themedShadow(t, 'card'),
  },
  primaryPressed: {
    backgroundColor: t.palette.brandPrimaryPressed,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: t.palette.borderStrong,
  },
  secondaryPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  dangerGhost: {
    backgroundColor: 'transparent',
  },
  dangerGhostPressed: {
    backgroundColor: t.palette.statusCancelledBg,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    fontWeight: '600' as const,
  },
  labelPrimary: {
    color: t.palette.btnPrimaryText,
  },
  labelSecondary: {
    color: t.palette.textPrimary,
  },
  labelDanger: {
    color: t.palette.statusCancelledBorder,
  },
  labelDangerPressed: {
    color: t.palette.statusCancelledBorder,
  },
}));
