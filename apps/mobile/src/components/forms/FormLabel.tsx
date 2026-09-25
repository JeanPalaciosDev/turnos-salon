import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface FormLabelProps {
  label: string;
  required?: boolean;
  optional?: boolean;
}

export function FormLabel({ label, required = false, optional = false }: FormLabelProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {required && <Text style={styles.required}> *</Text>}
      {optional && <Text style={styles.optional}> (opcional)</Text>}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  required: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.statusCancelledBorder,
  },
  optional: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
  },
}));
