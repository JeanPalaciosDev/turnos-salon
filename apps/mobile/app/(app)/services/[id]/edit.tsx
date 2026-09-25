import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import {
  ServiceValidationError,
  getService,
  setServiceActive,
  updateService,
} from '../../../../src/services/serviceRepository';
import { AppScreen } from '../../../../src/components/AppScreen';
import { Button } from '../../../../src/components/atoms';
import {
  DurationField,
  FieldWithSuffix,
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
  ToggleRow,
} from '../../../../src/components/forms';
import { createStyles } from '../../../../src/theme';

function parsePriceToCents(input: string): number {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

function centsToInput(amount: number): string {
  return (amount / 100).toLocaleString('es', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Pantalla 7b — Servicios, Editar (§8.6). Conectada a getService/updateService. */
export default function ServiceEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [name, setName] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('0');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [reapplication, setReapplication] = useState('');
  const [busy, setBusy] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  useEffect(() => {
    if (!profile || !id) return;
    let alive = true;
    void getService(profile, id)
      .then((s) => {
        if (!alive) return;
        setName(s.name);
        setHours(String(Math.floor(s.durationMinutes / 60)));
        setMinutes(String(s.durationMinutes % 60));
        setPrice(centsToInput(s.defaultPriceAmount));
        setCurrency(s.defaultPriceCurrency);
        setReapplication(s.reapplicationDays !== undefined ? String(s.reapplicationDays) : '');
        setIsActive(s.isActive);
        setLoaded(true);
      })
      .catch((e) => setErrors([e instanceof Error ? e.message : 'No se pudo cargar el servicio.']));
    return () => {
      alive = false;
    };
  }, [profile, id]);

  const onSave = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setErrors([]);
    try {
      const durationMinutes =
        (Number.parseInt(hours, 10) || 0) * 60 + (Number.parseInt(minutes, 10) || 0);
      const reapplicationDays = reapplication.trim()
        ? Number.parseInt(reapplication, 10)
        : undefined;
      await updateService(profile, id, {
        name,
        durationMinutes,
        defaultPriceAmount: parsePriceToCents(price),
        defaultPriceCurrency: currency,
        reapplicationDays,
      });
      await setServiceActive(profile, id, isActive);
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
      <FormHeaderRow title="Editar servicio" onBack={() => router.back()} />
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

        <ToggleRow label="Servicio activo" value={isActive} onValueChange={setIsActive} />

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Guardar cambios'}
            onPress={() => void onSave()}
            disabled={busy || !loaded}
          />
          <Button
            variant="danger-ghost"
            label="Eliminar servicio"
            onPress={() => router.push(`/(app)/services/${id}/delete`)}
          />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.xs },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
