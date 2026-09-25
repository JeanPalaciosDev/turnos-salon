import React, { useState } from 'react';
import { TextInput, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface FieldWithSuffixProps {
  value: string;
  onChangeText: (text: string) => void;
  suffix: string;
  placeholder?: string;
}

export function FieldWithSuffix({
  value,
  onChangeText,
  suffix,
  placeholder,
}: FieldWithSuffixProps) {
  const [focused, setFocused] = useState(false);
  const styles = useStyles();

  return (
    <View style={[styles.wrapper, focused && styles.wrapperFocused]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType="number-pad"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
        placeholderTextColor={styles.placeholder.color as string}
      />
      <View style={styles.suffixBox}>
        <Text style={styles.suffixText}>{suffix}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.control,
    overflow: 'hidden',
  },
  wrapperFocused: {
    borderWidth: 2,
    borderColor: t.palette.accentWarm,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: t.spacing.md,
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
    backgroundColor: t.palette.bgSurface,
  },
  suffixBox: {
    height: '100%',
    justifyContent: 'center',
    backgroundColor: t.palette.bgSunken,
    borderLeftWidth: 1,
    borderLeftColor: t.palette.borderSubtle,
    paddingHorizontal: t.spacing.md,
  },
  suffixText: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  placeholder: {
    color: t.palette.textMuted,
  },
}));
