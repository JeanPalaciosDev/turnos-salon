import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '../../../../src/auth/AuthProvider';
import {
  PaymentValidationError,
  recordPayment,
  type PaymentMethod,
} from '../../../../src/appointments/paymentRepository';
import { getBusinessBaseCurrency } from '../../../../src/services/serviceRepository';
import { AppScreen } from '../../../../src/components/AppScreen';
import { Button, Chip } from '../../../../src/components/atoms';
import {
  FieldWithSuffix,
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
} from '../../../../src/components/forms';
import { createStyles } from '../../../../src/theme';

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Efectivo' },
  { value: 'card', label: 'Tarjeta' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'other', label: 'Otro' },
];

/** Convierte "45,00" o "45.00" a enteros de la unidad mínima (4500). */
function parseAmountToMinorUnits(input: string): number {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return NaN;
  return Math.round(value * 100);
}

/** Convierte un tipo de cambio tecleado a número (acepta coma decimal). */
function parseRate(input: string): number | undefined {
  const normalized = input.replace(/\s/g, '').replace(',', '.');
  if (normalized.length === 0) return undefined;
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : NaN;
}

/** Pantalla modal — Registrar cobro de un turno. Solo owner (lo revalida el repositorio). */
export default function RecordPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, syncNow } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [currency, setCurrency] = useState('ARS');
  const [baseCurrency, setBaseCurrency] = useState('ARS');
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const styles = useStyles();

  useEffect(() => {
    if (!profile) return;
    let active = true;
    void getBusinessBaseCurrency(profile).then((c) => {
      if (active) {
        setBaseCurrency(c);
        setCurrency(c);
      }
    });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  const differsFromBase = currency.trim().toUpperCase() !== baseCurrency.trim().toUpperCase();

  const onSave = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setErrors([]);
    try {
      await recordPayment(profile, {
        appointmentId: id,
        amount: parseAmountToMinorUnits(amount),
        currency,
        method,
        exchangeRate: differsFromBase ? parseRate(rate) : undefined,
        exchangeBaseCurrency: differsFromBase ? baseCurrency : undefined,
      });
      await syncNow();
      router.back();
    } catch (e) {
      if (e instanceof PaymentValidationError) setErrors(e.messages);
      else setErrors([e instanceof Error ? e.message : 'No se pudo registrar el cobro.']);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Registrar cobro" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.body}>
        <FormGroup>
          <FormLabel label="Monto" required />
          <FieldWithSuffix
            value={amount}
            onChangeText={setAmount}
            suffix={currency}
            placeholder="0,00"
          />
        </FormGroup>

        <FormGroup>
          <FormLabel label="Método" />
          <View style={styles.methods}>
            {METHODS.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                selected={method === m.value}
                onPress={() => setMethod(m.value)}
              />
            ))}
          </View>
        </FormGroup>

        <FormGroup>
          <FormLabel label="Moneda" />
          <FormInput
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
            placeholder="ARS"
          />
          <FormHint text={`Moneda base del negocio: ${baseCurrency}`} />
        </FormGroup>

        {differsFromBase ? (
          <FormGroup>
            <FormLabel label={`Tipo de cambio a ${baseCurrency}`} required />
            <FormInput
              value={rate}
              onChangeText={setRate}
              placeholder="Ej. 1200"
              keyboardType="number-pad"
            />
            <FormHint text={`Cuánto vale 1 ${currency.toUpperCase()} en ${baseCurrency}.`} />
          </FormGroup>
        ) : null}

        {errors.map((msg) => (
          <FormHint key={msg} text={msg} variant="error" />
        ))}
      </ScrollView>

      <View style={styles.footerWrap}>
        <FormFooter>
          <Button
            variant="primary"
            label={busy ? 'Guardando…' : 'Registrar cobro'}
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
  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  footerWrap: { paddingBottom: t.spacing.lg },
}));
