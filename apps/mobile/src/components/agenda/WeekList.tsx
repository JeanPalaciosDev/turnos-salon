import React from 'react';
import { FlatList, View } from 'react-native';

import { createStyles } from '../../theme';
import { AppointmentCard, type AppointmentCardStatus } from './AppointmentCard';

interface WeekListItem {
  id: string;
  time: string;
  clientName: string;
  serviceName: string;
  workerName?: string;
  status: AppointmentCardStatus;
  colorIndex?: number;
}

interface WeekListProps {
  items: WeekListItem[];
  onItemPress: (id: string) => void;
}

export function WeekList({ items, onItemPress }: WeekListProps) {
  const styles = useStyles();

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <AppointmentCard
          time={item.time}
          clientName={item.clientName}
          serviceName={item.serviceName}
          status={item.status}
          workerName={item.workerName}
          colorIndex={item.colorIndex}
          onPress={() => onItemPress(item.id)}
        />
      )}
    />
  );
}

const useStyles = createStyles((t) => ({
  content: {
    paddingHorizontal: t.spacing.xl,
    paddingVertical: t.spacing.md,
  },
  separator: {
    height: t.spacing.sm,
  },
}));
