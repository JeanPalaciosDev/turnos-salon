import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface ListScreenHeaderProps {
  title: string;
  count?: number;
}

export function ListScreenHeader({ title, count }: ListScreenHeaderProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined ? (
        <Text style={styles.count}>{count}</Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.lg,
  },
  title: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textPrimary,
  },
  count: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
}));
