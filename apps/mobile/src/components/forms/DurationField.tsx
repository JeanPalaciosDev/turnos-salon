import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';
import { FieldWithSuffix } from './FieldWithSuffix';

interface DurationFieldProps {
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}

export function DurationField({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
}: DurationFieldProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      <View style={styles.segment}>
        <FieldWithSuffix
          value={hours}
          onChangeText={onHoursChange}
          suffix="hs"
          placeholder="0"
        />
      </View>
      <View style={styles.segment}>
        <FieldWithSuffix
          value={minutes}
          onChangeText={onMinutesChange}
          suffix="min"
          placeholder="0"
        />
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },
  segment: {
    flex: 1,
  },
}));
