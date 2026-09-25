import React, { useState } from 'react';
import { TextInput, type KeyboardTypeOptions } from 'react-native';

import { createStyles } from '../../theme';

interface FormInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  editable?: boolean;
}

export function FormInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType,
  multiline = false,
  editable = true,
}: FormInputProps) {
  const [focused, setFocused] = useState(false);
  const styles = useStyles();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
      editable={editable}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.input,
        multiline && styles.inputMultiline,
        focused && styles.inputFocused,
        !editable && styles.inputDisabled,
      ]}
      placeholderTextColor={styles.placeholder.color as string}
    />
  );
}

const useStyles = createStyles((t) => ({
  input: {
    backgroundColor: t.palette.bgSurface,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.control,
    height: 44,
    paddingHorizontal: t.spacing.md,
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  inputMultiline: {
    height: undefined,
    minHeight: 80,
    paddingTop: t.spacing.md,
    paddingBottom: t.spacing.md,
    textAlignVertical: 'top',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: t.palette.accentWarm,
  },
  inputDisabled: {
    backgroundColor: t.palette.bgSunken,
    color: t.palette.textMuted,
  },
  placeholder: {
    color: t.palette.textMuted,
  },
}));
