import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import { observeServices } from '../../../src/services/serviceRepository';
import type { ServiceModel } from '../../../src/database/models';
import { useObservable } from '../../../src/lib/useObservable';
import {
  getAppointmentDraft,
  patchAppointmentDraft,
} from '../../../src/appointments/appointmentDraft';
import { Button } from '../../../src/components/atoms';
import {
  ModalPanel,
  PickerCreateRow,
  PickerModalHeader,
  ServiceOptionRow,
} from '../../../src/components/modals';
import { createStyles } from '../../../src/theme';

function formatPrice(amount: number, currency: string): string {
  const value = (amount / 100).toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${value} ${currency}`;
}

/** Pantalla 17 — Buscador de servicios (§8.7). Multi-select, datos reales. */
export default function PickServicesModal() {
  const { profile } = useAuth();
  const [selected, setSelected] = useState<string[]>(() => getAppointmentDraft().serviceIds);
  const styles = useStyles();

  const services = useObservable(
    () => (profile ? observeServices(profile) : undefined),
    [profile?.id],
    [] as ServiceModel[],
  );

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const confirm = () => {
    const chosen = services.filter((s) => selected.includes(s.id));
    patchAppointmentDraft({
      serviceIds: chosen.map((s) => s.id),
      serviceNames: chosen.map((s) => s.name),
    });
    router.back();
  };

  return (
    <ModalPanel visible onClose={() => router.back()}>
      <PickerModalHeader
        title="Servicios"
        subtitle={`${selected.length} elegidos`}
        onClose={() => router.back()}
      />
      <ScrollView style={styles.list}>
        <PickerCreateRow
          label="Crear nuevo servicio"
          onPress={() => router.push('/(app)/services/new')}
        />
        {services.map((s) => (
          <ServiceOptionRow
            key={s.id}
            label={s.name}
            price={formatPrice(s.defaultPriceAmount, s.defaultPriceCurrency)}
            duration={`${s.durationMinutes} min`}
            selected={selected.includes(s.id)}
            onPress={() => toggle(s.id)}
          />
        ))}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          variant="primary"
          label={`Agregar ${selected.length} servicios`}
          onPress={confirm}
        />
      </View>
    </ModalPanel>
  );
}

const useStyles = createStyles((t) => ({
  list: { marginHorizontal: -t.spacing.xl },
  footer: { paddingTop: t.spacing.md },
}));
