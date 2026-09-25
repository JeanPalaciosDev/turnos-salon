import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { BackArrow } from '../atoms';

interface FormHeaderRowProps {
  title: string;
  onBack?: () => void;
}

export function FormHeaderRow({ title, onBack }: FormHeaderRowProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      {onBack ? (
        <BackArrow onPress={onBack} />
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onBack ? <View style={styles.spacer} /> : <View style={styles.spacer} />}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    paddingHorizontal: t.spacing.xl,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textPrimary,
  },
  spacer: {
    width: 36,
  },
}));
