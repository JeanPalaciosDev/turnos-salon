import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';

interface NowLineProps {
  topOffset: number;
}

export function NowLine({ topOffset }: NowLineProps) {
  const styles = useStyles();

  return (
    <View style={[styles.line, { top: topOffset }]}>
      <View style={styles.dot} />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  line: {
    position: 'absolute',
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
