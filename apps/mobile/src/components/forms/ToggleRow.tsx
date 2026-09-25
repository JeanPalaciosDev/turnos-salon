import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { ToggleSwitch } from '../atoms';

interface ToggleRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function ToggleRow({ label, value, onValueChange }: ToggleRowProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <ToggleSwitch value={value} onValueChange={onValueChange} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
  },
  label: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
}));
