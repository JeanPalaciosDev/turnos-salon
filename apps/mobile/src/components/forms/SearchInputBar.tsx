import React from 'react';
import { TextInput, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface SearchInputBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
}

export function SearchInputBar({
  placeholder = 'Buscar...',
  value,
  onChangeText,
}: SearchInputBarProps) {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔍</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={styles.placeholder.color as string}
        style={styles.input}
      />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    backgroundColor: t.palette.bgSunken,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.lg,
    gap: t.spacing.sm,
  },
  icon: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    color: t.palette.textMuted,
  },
  input: {
    flex: 1,
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
  },
  placeholder: {
    color: t.palette.textMuted,
  },
}));
