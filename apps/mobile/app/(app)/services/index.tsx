import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeServices } from '../../../src/services/serviceRepository';
import type { ServiceModel } from '../../../src/database/models';
import { useObservable } from '../../../src/lib/useObservable';
import { AppScreen } from '../../../src/components/AppScreen';
import { FabButton, IconButton } from '../../../src/components/atoms';
import { SearchInputBar } from '../../../src/components/forms';
import { FilterBar, ListItem, ListScreenHeader } from '../../../src/components/lists';
import { createStyles } from '../../../src/theme';

function formatPrice(amount: number, currency: string): string {
  const value = (amount / 100).toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${value} ${currency}`;
}

/** Pantalla 6 — Servicios, Lista (§8.5). Conectada a datos reales. */
export default function ServicesListScreen() {
  const { profile } = useAuth();
  const [filter, setFilter] = useState('Todos');
  const styles = useStyles();

  const services = useObservable(
    () => (profile ? observeServices(profile) : undefined),
    [profile?.id],
    [] as ServiceModel[],
  );

  const visible = useMemo(() => {
    if (filter === 'Activos') return services.filter((s) => s.isActive);
    if (filter === 'Inactivos') return services.filter((s) => !s.isActive);
    return services;
  }, [services, filter]);

  return (
    <AppScreen fab={<FabButton onPress={() => router.push('/(app)/services/new')} />}>
      <ScrollView>
        <ListScreenHeader title="Servicios" count={services.length} />
        <SearchInputBar placeholder="Buscar servicios..." />
        <FilterBar
          filters={['Todos', 'Activos', 'Inactivos']}
          selected={filter}
          onSelect={setFilter}
        />
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No hay servicios para mostrar.</Text>
          </View>
        ) : (
          visible.map((s) => (
            <ListItem
              key={s.id}
              avatar={{ name: s.name }}
              title={s.name}
              subtitle={`${s.durationMinutes} min · ${formatPrice(s.defaultPriceAmount, s.defaultPriceCurrency)}`}
              badge={{ label: s.isActive ? 'Activo' : 'Inactivo', active: s.isActive }}
              trailing={
                <IconButton
                  icon="✎"
                  onPress={() => router.push(`/(app)/services/${s.id}/edit`)}
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
