import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles } from '../../theme';

interface LinkTextProps {
  label: string;
  onPress: () => void;
}

export function LinkText({ label, onPress }: LinkTextProps) {
  const styles = useStyles();

  return (
    <Pressable onPress={onPress} accessibilityRole="link">
      {({ pressed }) => (
        <Text style={[styles.text, pressed && styles.textPressed]}>{label}</Text>
      )}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  text: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.brandPrimary,
    textDecorationLine: 'underline',
  },
  textPressed: {
    color: t.palette.brandPrimaryPressed,
  },
}));
