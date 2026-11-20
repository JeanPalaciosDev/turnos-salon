import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles, themedShadow, useTheme } from '../../theme';

export type AppointmentCardStatus =
  | 'confirmed'
  | 'pending'
  | 'active'
  | 'done'
  | 'cancelled'
  | 'noshow';

interface AppointmentCardProps {
  time: string;
  /** Hora de fin; con ella la tarjeta muestra el rango (design.md §4). */
  endTime?: string;
  clientName: string;
  serviceName: string;
  status: AppointmentCardStatus;
  workerName?: string;
  colorIndex?: number;
  onPress?: () => void;
}

type StatusTokens = {
  border: string;
  bg: string;
};

/**
 * Ícono por estado. design.md §2.4 lo exige: el estado nunca se comunica solo
 * por color, para que sea legible con daltonismo. §4 lo ubica al inicio de la
 * fila de la hora.
 */
const STATUS_ICON: Record<AppointmentCardStatus, string> = {
  // Un glifo distinto por estado: ○ agendado y ● en curso se diferencian por el
  // relleno, y ✓ queda para el turno ya terminado.
  confirmed: '○',
  pending: '⏱',
  active: '●',
  done: '✓',
  cancelled: '✕',
  noshow: '⃠',
};

function getStatusTokens(
  palette: ReturnType<typeof useTheme>['palette'],
  status: AppointmentCardStatus
): StatusTokens {
  switch (status) {
    case 'confirmed':
      return { border: palette.statusConfirmedBorder, bg: palette.statusConfirmedBg };
    case 'pending':
      return { border: palette.statusPendingBorder, bg: palette.statusPendingBg };
    case 'active':
      return { border: palette.statusActiveBorder, bg: palette.statusActiveBg };
    case 'done':
      return { border: palette.statusDoneBorder, bg: palette.statusDoneBg };
    case 'cancelled':
      return { border: palette.statusCancelledBorder, bg: palette.statusCancelledBg };
    case 'noshow':
      return { border: palette.statusNoshowBorder, bg: palette.statusNoshowBg };
  }
}

export function AppointmentCard({
  time,
  endTime,
  clientName,
  serviceName,
  status,
  workerName,
  colorIndex = 0,
  onPress,
}: AppointmentCardProps) {
  const styles = useStyles();
  const { palette, personColors, tabularNums } = useTheme();
  const { border, bg } = getStatusTokens(palette, status);
  const personColor = personColors[colorIndex % 3];

  const cardContent = (
    <View
      style={[
        styles.card,
        { backgroundColor: bg, borderLeftColor: border },
        status === 'cancelled' && styles.cancelled,
      ]}
    >
      <View style={styles.timeRow}>
        <Text style={styles.statusIcon}>{STATUS_ICON[status]}</Text>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Text style={[styles.time, tabularNums as any]}>
          {endTime ? `${time} – ${endTime}` : time}
        </Text>
      </View>
      <Text style={styles.clientName} numberOfLines={1}>
        {clientName}
      </Text>
      <Text style={styles.serviceName} numberOfLines={1}>
        {serviceName}
      </Text>
      {workerName ? (
        <View style={styles.workerRow}>
          <View style={[styles.personDot, { backgroundColor: personColor }]} />
          <Text style={styles.workerName} numberOfLines={1}>
            {workerName}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

const useStyles = createStyles((t) => ({
  card: {
    borderLeftWidth: 3,
    borderRadius: t.radius.card,
    overflow: 'hidden',
    padding: t.spacing.lg,
    gap: t.spacing.xs,
    ...themedShadow(t, 'card'),
  },
  cancelled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.85,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  // El ícono va en textPrimary, no en el color del estado: ese color sobre el
  // fondo tenue cae a 2,44:1 y el ícono es el único portador no cromático del
  // estado en la tarjeta. Lo que distingue es la FORMA del glifo; el color del
  // estado lo sostiene el borde lateral.
  statusIcon: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    color: t.palette.textPrimary,
  },
  time: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
  clientName: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  serviceName: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
  },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
  },
  personDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  workerName: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));
