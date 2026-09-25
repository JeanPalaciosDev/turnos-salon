import React from 'react';
import { Text, View } from 'react-native';

import { createStyles } from '../../theme';

export function WeekEmptyState() {
  const styles = useStyles();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📋</Text>
      <Text style={styles.message}>No hay turnos agendados para este día</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: t.spacing.xl,
    gap: t.spacing.lg,
  },
  emoji: {
    fontSize: 32,
    lineHeight: 40,
    textAlign: 'center',
  },
  message: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
    textAlign: 'center',
  },
}));
