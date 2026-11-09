import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { setCommissionsEnabled } from '../../src/commissions/commissionRepository';
import { useCommissionsEnabled } from '../../src/lib/businessConfig';
import { AppScreen } from '../../src/components/AppScreen';
import { HomeHeader, SectionHeading } from '../../src/components/detail';
import { ToggleRow } from '../../src/components/forms';
import { createStyles } from '../../src/theme';

/**
 * Ajustes del negocio (owner). Hoy expone el interruptor del sistema de
 * comisiones (feature opcional, apagada por defecto). Cambiarlo va por la RPC
 * set_commissions_enabled (online) y dispara un sync para confirmar el valor.
 */
export default function SettingsScreen() {
  const { profile, syncNow } = useAuth();
  const commissionsEnabled = useCommissionsEnabled(profile);
  const styles = useStyles();
  const [saving, setSaving] = useState(false);

  if (profile && profile.role !== 'owner') {
    return <Redirect href="/(app)/worker" />;
  }

  const onToggleCommissions = async (next: boolean) => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      await setCommissionsEnabled(profile, next);
      await syncNow();
    } catch (error) {
      Alert.alert(
        'No se pudo guardar',
        error instanceof Error ? error.message : 'Intenta de nuevo.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <HomeHeader greeting="Ajustes" subgreeting="Configuración del negocio" />

        <SectionHeading title="Comisiones" />
        <View style={styles.section}>
          <ToggleRow
            label="Usar comisiones"
            value={commissionsEnabled}
            onValueChange={onToggleCommissions}
          />
          <Text style={styles.hint}>
            Activa el cálculo de comisiones por trabajador y el panel de ingresos
            del negocio. Puedes desactivarlo cuando quieras.
          </Text>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  scroll: { paddingBottom: t.spacing.xxl },
  section: {
    paddingHorizontal: t.spacing.xl,
    gap: t.spacing.xs,
  },
  hint: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));
