import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';

import { useAuth } from '../../src/auth/AuthProvider';
import { AppScreen } from '../../src/components/AppScreen';
import { Button } from '../../src/components/atoms';
import {
  FormFooter,
  FormGroup,
  FormHint,
  FormInput,
  FormLabel,
  FormSelect,
} from '../../src/components/forms';
import { SelectModal, type SelectOption } from '../../src/components/modals';
import { BrandBlock } from '../../src/components/detail';
import { createStyles } from '../../src/theme';

const CURRENCIES: SelectOption[] = [
  { value: 'ARS', label: 'ARS', subtitle: 'Peso argentino' },
  { value: 'USD', label: 'USD', subtitle: 'Dólar estadounidense' },
  { value: 'UYU', label: 'UYU', subtitle: 'Peso uruguayo' },
  { value: 'BRL', label: 'BRL', subtitle: 'Real brasileño' },
  { value: 'CLP', label: 'CLP', subtitle: 'Peso chileno' },
  { value: 'EUR', label: 'EUR', subtitle: 'Euro' },
];

const TIMEZONES: SelectOption[] = [
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires', subtitle: 'GMT-3' },
  { value: 'America/Montevideo', label: 'Montevideo', subtitle: 'GMT-3' },
  { value: 'America/Santiago', label: 'Santiago', subtitle: 'GMT-3/-4' },
  { value: 'America/Sao_Paulo', label: 'São Paulo', subtitle: 'GMT-3' },
  { value: 'America/Mexico_City', label: 'Ciudad de México', subtitle: 'GMT-6' },
  { value: 'America/Bogota', label: 'Bogotá', subtitle: 'GMT-5' },
  { value: 'Europe/Madrid', label: 'Madrid', subtitle: 'GMT+1/+2' },
];

function labelFor(options: SelectOption[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * Alta del negocio del owner (status needs-bootstrap). Moneda base y zona
 * horaria son selectores (SelectModal) para evitar entrada libre inválida.
 */
export default function BootstrapScreen() {
  const { completeOwnerBootstrap } = useAuth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('ARS');
  const [timezone, setTimezone] = useState('America/Argentina/Buenos_Aires');
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const styles = useStyles();

  const onSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      await completeOwnerBootstrap({ name, baseCurrency: currency, timezone });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el salón.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <ScrollView contentContainerStyle={styles.body}>
        <BrandBlock tagline="Configurá tu salón" />

        <FormGroup>
          <FormLabel label="Nombre del salón" required />
          <FormInput value={name} onChangeText={setName} placeholder="Mi Salón" />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Moneda base" />
          <FormSelect
            value={`${currency} — ${labelFor(CURRENCIES, currency)}`}
            placeholder="Elegir moneda"
            onPress={() => setCurrencyOpen(true)}
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Zona horaria" />
          <FormSelect
            value={labelFor(TIMEZONES, timezone)}
            placeholder="Elegir zona horaria"
            onPress={() => setTimezoneOpen(true)}
          />
        </FormGroup>

        {error ? <FormHint text={error} variant="error" /> : null}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Creando…' : 'Crear salón'}
            onPress={() => void onSubmit()}
            disabled={busy}
          />
        </FormFooter>
      </View>

      <SelectModal
        visible={currencyOpen}
        title="Moneda base"
        options={CURRENCIES}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setCurrencyOpen(false)}
      />
      <SelectModal
        visible={timezoneOpen}
        title="Zona horaria"
        options={TIMEZONES}
        selected={timezone}
        onSelect={setTimezone}
        onClose={() => setTimezoneOpen(false)}
      />
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: { padding: t.spacing.xl, gap: t.spacing.lg, flexGrow: 1, justifyContent: 'center' },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
