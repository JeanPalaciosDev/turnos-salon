import React from 'react';
import { Pressable, Text } from 'react-native';

import { createStyles, themedShadow } from '../../theme';

interface FabButtonProps {
  onPress?: () => void;
}

export function FabButton({ onPress }: FabButtonProps) {
  const styles = useStyles();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityLabel="Crear"
      accessibilityRole="button"
    >
      {({ pressed: _pressed }) => <Text style={styles.icon}>+</Text>}
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: t.palette.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    ...themedShadow(t, 'fab'),
  },
  fabPressed: {
    backgroundColor: t.palette.brandPrimaryPressed,
  },
  icon: {
    fontSize: 24,
    color: t.palette.btnPrimaryText,
    lineHeight: 28,
    fontFamily: t.typeScale.body.fontFamily,
  },
}));
