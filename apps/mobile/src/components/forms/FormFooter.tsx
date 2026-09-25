import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';

interface FormFooterProps {
  children: React.ReactNode;
}

export function FormFooter({ children }: FormFooterProps) {
  const styles = useStyles();
  return <View style={styles.footer}>{children}</View>;
}

const useStyles = createStyles((t) => ({
  footer: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl,
    borderTopWidth: 1,
    borderTopColor: t.palette.borderSubtle,
  },
}));
