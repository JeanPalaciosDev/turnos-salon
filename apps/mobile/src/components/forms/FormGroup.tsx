import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';

interface FormGroupProps {
  children: React.ReactNode;
}

export function FormGroup({ children }: FormGroupProps) {
  const styles = useStyles();
  return <View style={styles.group}>{children}</View>;
}

const useStyles = createStyles((t) => ({
  group: {
    gap: t.spacing.xs,
    marginBottom: t.spacing.lg,
  },
}));
