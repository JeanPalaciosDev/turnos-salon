import React from 'react';
import { ScrollView } from 'react-native';

import { Chip } from '../atoms/Chip';
import { createStyles } from '../../theme';

interface FilterBarProps {
  filters: string[];
  selected: string;
  onSelect: (value: string) => void;
}

export function FilterBar({ filters, selected, onSelect }: FilterBarProps) {
  const styles = useStyles();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {filters.map((filter) => (
        <Chip
          key={filter}
          label={filter}
          selected={filter === selected}
          onPress={() => onSelect(filter)}
        />
      ))}
    </ScrollView>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.sm,
  },
}));
