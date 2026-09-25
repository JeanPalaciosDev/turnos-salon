import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface SectionHeadingProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeading({ title, action }: SectionHeadingProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {action && (
        <Pressable onPress={action.onPress} hitSlop={8}>
          {({ pressed }) => (
            <Text style={[styles.action, pressed && styles.actionPressed]}>
              {action.label}
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
  },
  title: {
    flex: 1,
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  action: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.brandPrimary,
  },
  actionPressed: {
    color: t.palette.brandPrimaryPressed,
  },
}));
