import {useEffect, useRef, useState} from 'react';
import {Text, View} from 'react-native';
import {router, useLocalSearchParams} from 'expo-router';

import {useAuth} from '../../../../src/auth/AuthProvider';
import {generateInviteCode, type InviteCodeResult} from '../../../../src/workers/generateInviteCode';
import {AppScreen} from '../../../../src/components';
import {Button} from '../../../../src/components/atoms';
import {FormFooter, FormHeaderRow, FormHint} from '../../../../src/components/forms';
import {createStyles, useTheme} from '../../../../src/theme';

const COUNTDOWN_SECONDS = 60;

/**
 * Modal de generación de código de vinculación (owner). Genera un código al
 * montar y muestra un countdown de 60 segundos. Al expirar, el dueño puede
 * generar un nuevo código.
 */
export default function WorkerInviteScreen() {
  const {id} = useLocalSearchParams<{ id: string }>();
  const {profile} = useAuth();
  const [result, setResult] = useState<InviteCodeResult | null>(null);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const styles = useStyles();
  const {tabularNums} = useTheme();

  const clearCountdown = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startCountdown = () => {
    clearCountdown();
    setSeconds(COUNTDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearCountdown();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  const fetchCode = async () => {
    if (!profile || !id) return;
    setBusy(true);
    setError(null);
    try {
      const data = await generateInviteCode(profile, id);
      setResult(data);
      startCountdown();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el código.');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (profile && id && !result && !busy) {
      void fetchCode();
    }
    return () => clearCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, id]);

  const expired = seconds === 0 && result !== null;

  return (
    <AppScreen header={false}>
      <FormHeaderRow title="Código de vinculación" onBack={() => router.back()}/>

      <View style={styles.body}>
        {error ? (
          <FormHint text={error} variant="error"/>
        ) : null}

        {result && !expired ? (
          <>
            <Text style={styles.instruction}>
              Compartí este código con el profesional. Válido por {seconds} segundo{seconds !== 1 ? 's' : ''}.
            </Text>

            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Text style={[styles.code, tabularNums as any]}>{result.code}</Text>

            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {width: `${(seconds / COUNTDOWN_SECONDS) * 100}%` as unknown as number},
                ]}
              />
            </View>
          </>
        ) : null}

        {expired ? (
          <View style={styles.expiredBox}>
            <Text style={styles.expiredIcon}>⏱</Text>
            <Text style={styles.expiredText}>El código expiró</Text>
            <Text style={styles.expiredSub}>
              Generá uno nuevo para que el profesional pueda vincularse.
            </Text>
          </View>
        ) : null}

        {!result && !error && busy ? (
          <Text style={styles.instruction}>Generando código…</Text>
        ) : null}
      </View>

      <View style={styles.footerWrap}>
        <FormFooter>
          {expired || error ? (
            <Button
              variant="primary"
              label={busy ? 'Generando…' : 'Generar nuevo código'}
              onPress={() => void fetchCode()}
              disabled={busy}
            />
          ) : null}
          <Button
            variant="secondary"
            label="Cerrar"
            onPress={() => router.back()}
          />
        </FormFooter>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  body: {
    flex: 1,
    paddingHorizontal: t.spacing.xl,
    paddingTop: t.spacing.xl,
    gap: t.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instruction: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
    textAlign: 'center',
  },
  code: {
    fontSize: 48,
    lineHeight: 60,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.brandPrimary,
    letterSpacing: 8,
    textAlign: 'center',
  },
  progressBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: t.palette.bgSunken,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    backgroundColor: t.palette.brandPrimary,
    borderRadius: t.radius.pill,
  },
  expiredBox: {
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.xl,
    backgroundColor: t.palette.statusCancelledBg,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: t.palette.statusCancelledBorder,
    width: '100%',
  },
  expiredIcon: {
    fontSize: 32,
    lineHeight: 40,
  },
  expiredText: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.statusCancelledBorder,
    textAlign: 'center',
  },
  expiredSub: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
    textAlign: 'center',
  },
  footerWrap: {paddingBottom: t.spacing.lg},
}));
