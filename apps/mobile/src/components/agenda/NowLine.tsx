import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';

interface NowLineProps {
  /**
   * Desplazamiento vertical en px para posicionar la línea de forma absoluta
   * sobre una grilla horaria. Si se omite, la línea se renderiza en el flujo
   * normal (para intercalarla entre tarjetas de una lista cronológica).
   */
  topOffset?: number;
}

export function NowLine({ topOffset }: NowLineProps) {
  const styles = useStyles();
  const positioned = topOffset !== undefined;

  return (
    <View style={[styles.line, positioned && { position: 'absolute', top: topOffset }]}>
      <View style={styles.dot} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  line: {
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: t.palette.brandPrimary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.palette.brandPrimary,
    marginLeft: -4,
    marginTop: -3,
  },
}));
