import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface BrandBlockProps {
  name?: string;
  tagline?: string;
}

export function BrandBlock({
  name = 'Turnos Salón',
  tagline = 'Tu agenda, simple y cálida',
}: BrandBlockProps) {
  const styles = useStyles();
  const initial = (name.charAt(0) || 'T').toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.logoBox}>
        <Text style={styles.initial}>{initial}</Text>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.spacing.lg,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: t.radius.modal,
    backgroundColor: t.palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 36,
    lineHeight: 44,
    fontFamily: 'Fraunces-SemiBold',
    color: t.palette.brandPrimary,
  },
  name: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textPrimary,
  },
  tagline: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
    textAlign: 'center',
  },
}));
