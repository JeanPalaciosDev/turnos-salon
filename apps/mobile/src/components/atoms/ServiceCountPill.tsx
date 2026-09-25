import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface ServiceCountPillProps {
  count: number;
}

export function ServiceCountPill({ count }: ServiceCountPillProps) {
  const styles = useStyles();

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{count}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  pill: {
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.brandPrimary,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xs,
  },
  label: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.btnPrimaryText,
    textAlign: 'center',
  },
}));
