import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeWorkers } from '../../../src/workers/workerRepository';
import type { WorkerModel } from '../../../src/database/models';
import { useObservable } from '../../../src/lib/useObservable';
import { AppScreen } from '../../../src/components/AppScreen';
import { FabButton, IconButton } from '../../../src/components/atoms';
import { SearchInputBar } from '../../../src/components/forms';
import { ListItem, ListScreenHeader } from '../../../src/components/lists';
import { createStyles } from '../../../src/theme';

/** Pantalla 9 — Trabajadores, Lista (§8.5). Conectada a datos reales. */
export default function WorkersListScreen() {
  const { profile } = useAuth();
  const styles = useStyles();

  const workers = useObservable(
    () => (profile ? observeWorkers(profile) : undefined),
    [profile?.id],
    [] as WorkerModel[],
  );

  return (
    <AppScreen fab={<FabButton onPress={() => router.push('/(app)/workers/new')} />}>
      <ScrollView>
        <ListScreenHeader title="Trabajadores" count={workers.length} />
        <SearchInputBar placeholder="Buscar trabajadores..." />
        {workers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay trabajadores para mostrar.</Text>
          </View>
        ) : (
          workers.map((w) => (
            <ListItem
              key={w.id}
              avatar={{ name: w.name }}
              title={w.name}
              subtitle={w.phone ?? 'Sin teléfono'}
              badge={{ label: w.isActive ? 'Activo' : 'Inactivo', active: w.isActive }}
              trailing={
                <IconButton
                  icon="✎"
                  onPress={() => router.push(`/(app)/workers/${w.id}/edit`)}
                />
              }
            />
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  empty: { padding: t.spacing.xxl, alignItems: 'center' },
  emptyText: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textMuted,
    textAlign: 'center',
  },
}));
