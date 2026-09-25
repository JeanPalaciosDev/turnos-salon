import React from 'react';
import { View } from 'react-native';

import { createStyles } from '../../theme';
import { DayPill } from './DayPill';

interface DayItem {
  dayName: string;
  dayNumber: number;
  hasTurnos?: boolean;
}

interface DaySelectorRowProps {
  days: DayItem[];
  selectedIndex: number;
  todayIndex?: number;
  onSelect: (index: number) => void;
}

export function DaySelectorRow({
  days,
  selectedIndex,
  todayIndex,
  onSelect,
}: DaySelectorRowProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      {days.map((day, index) => (
        <DayPill
          key={index}
          dayName={day.dayName}
          dayNumber={day.dayNumber}
          hasTurnos={day.hasTurnos}
          selected={index === selectedIndex}
          today={index === todayIndex}
          onPress={() => onSelect(index)}
        />
      ))}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.xl,
  },
}));
