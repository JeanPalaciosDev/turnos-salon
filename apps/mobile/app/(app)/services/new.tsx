import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { canManageServices } from '@turnos/core';

import { useAuth } from '../../../src/auth/AuthProvider';
import { ServiceForm } from '../../../src/services/ServiceForm';
import {
  createService,
  getBusinessBaseCurrency,
  type ServiceDraft,
} from '../../../src/services/serviceRepository';
import { colors, spacing, typography } from '../../../src/theme';

export default function NewServiceScreen() {
  const { profile, status, syncNow } = useAuth();
  const [currency, setCurrency] = useState('ARS');
  const [isLoadingCurrency, setIsLoadingCurrency] = useState(true);
  const canManage = Boolean(profile && canManageServices(profile));

  useEffect(() => {
    if (!profile || !canManage) {
      return;
    }

    let isMounted = true;

    void getBusinessBaseCurrency(profile).then((value) => {
      if (isMounted) {
        setCurrency(value);
        setIsLoadingCurrency(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [canManage, profile]);

  const initialValue = useMemo<ServiceDraft>(
    () => ({
      name: '',
      durationMinutes: 30,
      defaultPriceAmount: 0,
      defaultPriceCurrency: currency,
    }),
    [currency]
  );

  if (status !== 'ready' || !profile || !canManage) {
    return <Redirect href="/home" />;
  }

  const handleSubmit = async (draft: ServiceDraft) => {
    await createService(profile, draft);
    await syncNow();
    router.replace('/services');
  };

  if (isLoadingCurrency) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.brandPrimary} />
        <Text style={styles.loadingText}>Preparando formulario…</Text>
      </View>
    );
  }

  return <ServiceForm initialValue={initialValue} onSubmit={handleSubmit} submitLabel="Guardar servicio" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgBase,
  },
  loadingText: {
    color: colors.textSecondary,
    ...typography.body,
    fontSize: 15,
  },
});
