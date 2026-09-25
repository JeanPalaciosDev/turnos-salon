import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../../src/auth/AuthProvider';
import {
  ServiceValidationError,
  createService,
  getBusinessBaseCurrency,
} from '../../../src/services/serviceRepository';
import { AppScreen } from '../../../src/components/AppScreen';
import { Button } from '../../../src/components/atoms';
import {
  DurationField,
  FieldWithSuffix,
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
} from '../../../src/components/forms';
import { createStyles } from '../../../src/theme';

/** Convierte "45,00" o "45.00" a centavos enteros (4500). */
function parsePriceToCents(input: string): number {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

/** Pantalla 7 — Servicios, Nuevo (§8.6). Conectada a createService. */
export default function ServiceNewScreen() {
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [price, setPrice] = useState('');
  // La moneda del servicio arranca en la moneda base del negocio (business_config),
  // no en un hardcode. Se carga de forma asíncrona cuando hay profile.
  const [currency, setCurrency] = useState('ARS');
  const [reapplication, setReapplication] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  // Trae la moneda base del negocio (business_config) para prellenar el sufijo
  // del precio, en vez de asumir una moneda fija.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    void getBusinessBaseCurrency(profile).then((c) => {
      if (active) setCurrency(c);
    });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const onSave = async () => {
    if (!profile) return;
    setBusy(true);
    setErrors([]);
    try {
      const durationMinutes =
        (Number.parseInt(hours, 10) || 0) * 60 + (Number.parseInt(minutes, 10) || 0);
      const reapplicationDays = reapplication.trim()
        ? Number.parseInt(reapplication, 10)
        : undefined;
      await createService(profile, {
        name,
        durationMinutes,
        defaultPriceAmount: parsePriceToCents(price),
        defaultPriceCurrency: currency,
        reapplicationDays,
      });
      await syncNow();
      router.back();
    } catch (e) {
      if (e instanceof ServiceValidationError) setErrors(e.messages);
      else setErrors([e instanceof Error ? e.message : 'No se pudo guardar el servicio.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Nuevo servicio" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Nombre" required />
          <FormInput value={name} onChangeText={setName} placeholder="Nombre del servicio" />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Duración" />
          <DurationField
            hours={hours}
            minutes={minutes}
            onHoursChange={setHours}
            onMinutesChange={setMinutes}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Plazo de reaplicación (días)" optional />
          <FormInput
            value={reapplication}
            onChangeText={setReapplication}
            placeholder="Ej. 30"
            keyboardType="number-pad"
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Precio" />
          <FieldWithSuffix value={price} onChangeText={setPrice} suffix={currency} placeholder="0,00" />
        </FormGroup>

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar servicio'}
            onPress={() => void onSave()}
            disabled={busy || !profile}
          />
          <Button variant="secondary" label="Cancelar" onPress={() => router.back()} />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
