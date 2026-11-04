import React from 'react';
import { FlatList, View } from 'react-native';

import { createStyles } from '../../theme';
import { AppointmentCard, type AppointmentCardStatus } from './AppointmentCard';
import { NowLine } from './NowLine';

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
  /**
   * Índice ante el cual se dibuja la línea de "ahora": la línea va antes del
   * item en esta posición. Un valor igual a items.length la dibuja al final
   * (todas las citas del día ya empezaron). undefined no la muestra (el día
   * seleccionado no es hoy).
   */
  nowIndex?: number;
}

export function WeekList({ items, onItemPress, nowIndex }: WeekListProps) {
  const styles = useStyles();

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.content}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListFooterComponent={
        nowIndex === items.length && items.length > 0 ? (
          <View style={styles.nowWrap}>
            <NowLine />
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <>
          {index === nowIndex ? (
            <View style={styles.nowWrap}>
              <NowLine />
            </View>
          ) : null}
          <AppointmentCard
            time={item.time}
            clientName={item.clientName}
            serviceName={item.serviceName}
            status={item.status}
            workerName={item.workerName}
            colorIndex={item.colorIndex}
            onPress={() => onItemPress(item.id)}
          />
        </>
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
  nowWrap: {
    paddingVertical: t.spacing.sm,
  },
}));
