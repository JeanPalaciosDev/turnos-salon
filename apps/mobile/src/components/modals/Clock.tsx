import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles, useTheme } from '../../theme';
import { Button, Chip } from '../atoms';

interface ClockProps {
  hour?: number;
  minute?: number;
  onConfirm: (hour: number, minute: number) => void;
  onCancel: () => void;
}

type Step = 'hour' | 'minute';
type AmPm = 'AM' | 'PM';

const CLOCK_SIZE = 240;
const CLOCK_RADIUS = CLOCK_SIZE / 2; // 120
const NUMBER_RADIUS = 95; // radio al centro de cada número
const NUMBER_BOX = 36;

/** Genera los 12 posiciones para hora (1-12) o minuto (0,5,10,...55). */
function getClockNumbers(step: Step): string[] {
  if (step === 'hour') {
    return ['12', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
  }
  return ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
}

/** Calcula top/left para el centro de cada número (position absolute). */
function numberPosition(index: number): { top: number; left: number } {
  // El ángulo 0° apunta arriba (12 en punto); giramos en sentido horario.
  const angle = (index * 30 - 90) * (Math.PI / 180);
  const cx = CLOCK_RADIUS + NUMBER_RADIUS * Math.cos(angle) - NUMBER_BOX / 2;
  const cy = CLOCK_RADIUS + NUMBER_RADIUS * Math.sin(angle) - NUMBER_BOX / 2;
  return { left: cx, top: cy };
}

/** Ángulo (grados) de la manecilla para el índice dado (0 = arriba, CW). */
function handAngle(index: number): number {
  return index * 30 - 90;
}

/**
 * Reloj analógico de dos pasos. Paso 1: elegir hora (1-12 + AM/PM).
 * Paso 2: elegir minutos (00, 05, 10, ..., 55). Al confirmar devuelve
 * la hora en formato 24h.
 */
export function Clock({ hour, minute, onConfirm, onCancel }: ClockProps) {
  const now = new Date();
  const initHour = hour ?? now.getHours();
  const initMinute = minute ?? 0;

  const initAmPm: AmPm = initHour < 12 ? 'AM' : 'PM';
  // selectedHour es siempre 1-12 para la visualización del reloj
  const initDisplayHour = initHour % 12 === 0 ? 12 : initHour % 12;
  // índice dentro de los números del reloj de hora (12 está en posición 0)
  const initHourIndex = initDisplayHour === 12 ? 0 : initDisplayHour;
  // índice dentro de los números del reloj de minuto (00 en posición 0, cada 5 min)
  const initMinuteIndex = Math.round(initMinute / 5) % 12;

  const [step, setStep] = useState<Step>('hour');
  const [selectedHourIndex, setSelectedHourIndex] = useState(initHourIndex);
  const [selectedMinuteIndex, setSelectedMinuteIndex] = useState(initMinuteIndex);
  const [amPm, setAmPm] = useState<AmPm>(initAmPm);

  const styles = useStyles();
  const { palette, tabularNums } = useTheme();

  const numbers = getClockNumbers(step);

  /** Número visible en el readout para la hora (1-12). */
  const displayHour = selectedHourIndex === 0 ? 12 : selectedHourIndex;
  /** Número visible en el readout para los minutos. */
  const displayMinute = selectedMinuteIndex * 5;

  const readoutHH = String(displayHour).padStart(2, '0');
  const readoutMM = String(displayMinute).padStart(2, '0');

  const activeIndex = step === 'hour' ? selectedHourIndex : selectedMinuteIndex;
  const handDeg = handAngle(activeIndex);
  // Longitud de la manecilla: del centro al borde del número
  const handLength = NUMBER_RADIUS;

  const handleConfirm = () => {
    let h = displayHour;
    if (amPm === 'AM') {
      h = h === 12 ? 0 : h;
    } else {
      h = h === 12 ? 12 : h + 12;
    }
    onConfirm(h, displayMinute);
  };

  return (
    <View style={styles.container}>
      {/* Readout */}
      <View style={styles.readout}>
        <Pressable onPress={() => setStep('hour')}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Text style={[styles.readoutSegment, tabularNums as any, step === 'hour' && styles.readoutActive]}>
            {readoutHH}
          </Text>
        </Pressable>
        <Text style={styles.readoutColon}>:</Text>
        <Pressable onPress={() => setStep('minute')}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Text style={[styles.readoutSegment, tabularNums as any, step === 'minute' && styles.readoutActive]}>
            {readoutMM}
          </Text>
        </Pressable>
        <Text style={[styles.readoutSegment, styles.readoutAmPm]}>{amPm}</Text>
      </View>

      {/* Toggle AM/PM */}
      <View style={styles.amPmRow}>
        <Chip label="AM" selected={amPm === 'AM'} onPress={() => setAmPm('AM')} />
        <Chip label="PM" selected={amPm === 'PM'} onPress={() => setAmPm('PM')} />
      </View>

      {/* Cara analógica */}
      <View style={styles.clockFace}>
        {/* Manecilla */}
        <View
          style={[
            styles.hand,
            {
              height: handLength,
              transform: [{ rotate: `${handDeg + 90}deg` }],
            },
          ]}
        />
        {/* Punto central */}
        <View style={styles.centerDot} />

        {/* Números */}
        {numbers.map((num, index) => {
          const pos = numberPosition(index);
          const isSelected = index === activeIndex;
          return (
            <Pressable
              key={num}
              style={[
                styles.numberBtn,
                { top: pos.top, left: pos.left },
                isSelected && styles.numberBtnSelected,
              ]}
              onPress={() => {
                if (step === 'hour') {
                  setSelectedHourIndex(index);
                  // Auto-avanzar al paso de minutos al elegir hora
                  setStep('minute');
                } else {
                  setSelectedMinuteIndex(index);
                }
              }}
              accessibilityLabel={num}
            >
              <Text
                style={[
                  styles.numberText,
                  isSelected && styles.numberTextSelected,
                ]}
              >
                {step === 'minute' ? num.padStart(2, '0') : num}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerBtn}>
          <Button variant="secondary" label="Cancelar" onPress={onCancel} />
        </View>
        <View style={styles.footerBtn}>
          <Button variant="primary" label="Confirmar" onPress={handleConfirm} />
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    alignItems: 'center',
    gap: t.spacing.lg,
  },

  // Readout
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  readoutSegment: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textMuted,
  },
  readoutActive: {
    color: t.palette.brandPrimary,
  },
  readoutColon: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textMuted,
  },
  readoutAmPm: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    marginLeft: t.spacing.sm,
    color: t.palette.textMuted,
  },

  // Toggle AM/PM
  amPmRow: {
    flexDirection: 'row',
    gap: t.spacing.sm,
  },

  // Cara analógica
  clockFace: {
    width: CLOCK_SIZE,
    height: CLOCK_SIZE,
    borderRadius: CLOCK_RADIUS,
    backgroundColor: t.palette.bgSunken,
    position: 'relative',
  },

  // Manecilla: parte desde el centro. Se rota alrededor del extremo inferior
  // (transformOrigin no existe en RN, así que posicionamos partiendo del centro
  // y usamos la altura completa con translateY).
  hand: {
    position: 'absolute',
    width: 2,
    backgroundColor: t.palette.brandPrimary,
    top: CLOCK_RADIUS - NUMBER_RADIUS,
    left: CLOCK_RADIUS - 1,
    transformOrigin: `1px ${NUMBER_RADIUS}px`,
    borderRadius: 1,
  },

  // Punto central
  centerDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: t.palette.brandPrimary,
    top: CLOCK_RADIUS - 4,
    left: CLOCK_RADIUS - 4,
  },

  // Números en la cara
  numberBtn: {
    position: 'absolute',
    width: NUMBER_BOX,
    height: NUMBER_BOX,
    borderRadius: NUMBER_BOX / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBtnSelected: {
    backgroundColor: t.palette.brandPrimary,
  },
  numberText: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textPrimary,
  },
  numberTextSelected: {
    color: t.palette.btnPrimaryText,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    alignSelf: 'stretch',
  },
  footerBtn: {
    flex: 1,
  },
}));
