import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  const styles = useStyles();

  if (!label) {
    return <View style={styles.line} />;
  }

  return (
    <View style={styles.row}>
      <View style={styles.lineFlex} />
      <Text style={styles.text}>{label}</Text>
      <View style={styles.lineFlex} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  line: {
    height: 1,
    backgroundColor: t.palette.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  lineFlex: {
    flex: 1,
    height: 1,
    backgroundColor: t.palette.borderSubtle,
  },
  text: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.textMuted,
  },
}));
