import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface HomeHeaderProps {
  greeting: string;
  subgreeting?: string;
}

export function HomeHeader({ greeting, subgreeting }: HomeHeaderProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>{greeting}</Text>
      {subgreeting !== undefined && (
        <Text style={styles.subgreeting}>{subgreeting}</Text>
      )}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.lg,
    paddingBottom: t.spacing.sm,
    gap: t.spacing.xs,
  },
  greeting: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textPrimary,
  },
  subgreeting: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
  },
}));
