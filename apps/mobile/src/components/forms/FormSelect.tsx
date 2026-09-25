import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { Avatar } from '../atoms';

interface FormSelectProps {
  value: string;
  placeholder?: string;
  onPress: () => void;
  avatar?: { name: string; colorIndex?: number };
}

export function FormSelect({ value, placeholder, onPress, avatar }: FormSelectProps) {
  const styles = useStyles();
  const hasValue = value.length > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.select, pressed && styles.selectPressed]}
    >
      {avatar && (
        <Avatar name={avatar.name} size={28} colorIndex={avatar.colorIndex ?? 0} />
      )}
      <Text
        style={[styles.value, !hasValue && styles.placeholder]}
        numberOfLines={1}
      >
        {hasValue ? value : (placeholder ?? '')}
      </Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const useStyles = createStyles((t) => ({
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.palette.bgSurface,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.control,
    height: 44,
    paddingHorizontal: t.spacing.md,
    gap: t.spacing.sm,
  },
  selectPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  value: {
    flex: 1,
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  placeholder: {
    color: t.palette.textMuted,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 22,
    color: t.palette.textMuted,
  },
}));
