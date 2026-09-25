import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeClients } from '../../../src/clients/clientRepository';
import type { ClientModel } from '../../../src/database/models';
import { useObservable } from '../../../src/lib/useObservable';
import { AppScreen } from '../../../src/components/AppScreen';
import { FabButton, IconButton } from '../../../src/components/atoms';
import { SearchInputBar } from '../../../src/components/forms';
import { ListItem, ListScreenHeader } from '../../../src/components/lists';
import { createStyles } from '../../../src/theme';

/** Pantalla 10 — Clientes, Lista (§8.5). Conectada a datos reales. */
export default function ClientsListScreen() {
  const { profile } = useAuth();
  const styles = useStyles();

  const clients = useObservable(
    () => (profile ? observeClients(profile) : undefined),
    [profile?.id],
    [] as ClientModel[],
  );

  return (
    <AppScreen fab={<FabButton onPress={() => router.push('/(app)/clients/new')} />}>
      <ScrollView>
        <ListScreenHeader title="Clientes" count={clients.length} />
        <SearchInputBar placeholder="Buscar clientes..." />
        {clients.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay clientes para mostrar.</Text>
          </View>
        ) : (
          clients.map((c) => (
            <ListItem
              key={c.id}
              avatar={{ name: c.name }}
              title={c.name}
              subtitle={c.lastVisit ? `Última visita: ${c.lastVisit}` : 'Sin visitas'}
              trailing={
                <IconButton
                  icon="✎"
                  onPress={() => router.push(`/(app)/clients/${c.id}/edit`)}
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
