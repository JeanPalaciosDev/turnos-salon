import React from 'react';
import { Text } from 'react-native';

import { createStyles } from '../../theme';

interface FormHintProps {
  text: string;
  variant?: 'default' | 'error';
}

export function FormHint({ text, variant = 'default' }: FormHintProps) {
  const styles = useStyles();

  return (
    <Text style={[styles.hint, variant === 'error' && styles.hintError]}>{text}</Text>
  );
}

const useStyles = createStyles((t) => ({
  hint: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.textMuted,
  },
  hintError: {
    color: t.palette.statusCancelledBorder,
  },
}));
