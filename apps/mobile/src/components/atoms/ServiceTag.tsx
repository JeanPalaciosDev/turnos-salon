import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface ServiceTagProps {
  label: string;
  removable?: boolean;
  onRemove?: () => void;
}

export function ServiceTag({ label, removable = false, onRemove }: ServiceTagProps) {
  const styles = useStyles();

  return (
    <View style={styles.pill}>
      <Text style={styles.label}>{label}</Text>
      {removable && (
        <Pressable onPress={onRemove} hitSlop={6} accessibilityLabel="Quitar">
          <Text style={styles.remove}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    backgroundColor: t.palette.brandSoft,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.xs,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textPrimary,
  },
  remove: {
    fontSize: 14,
    lineHeight: 18,
    color: t.palette.textMuted,
  },
}));
