import React from 'react';
import { Text, View } from 'react-native';

import { createStyles, useTheme, type ResolvedTheme } from '../../theme';

export type AppointmentStatus =
  | 'creado'
  | 'pendiente'
  | 'curso'
  | 'finalizado'
  | 'ausente'
  | 'cancelado';

interface StatusChipProps {
  status: AppointmentStatus;
  /** Agrega borde de 1px del color del estado. */
  active?: boolean;
}

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  creado: 'Creado',
  pendiente: 'Pendiente',
  curso: 'En curso',
  finalizado: 'Finalizado',
  ausente: 'Ausente',
  cancelado: 'Cancelado',
};

type StatusColors = { border: string; bg: string };

function getStatusColors(t: ResolvedTheme, status: AppointmentStatus): StatusColors {
  switch (status) {
    case 'creado':
      return { border: t.palette.statusActiveBorder, bg: t.palette.statusActiveBg };
    case 'pendiente':
      return { border: t.palette.statusPendingBorder, bg: t.palette.statusPendingBg };
    case 'curso':
      return { border: t.palette.statusActiveBorder, bg: t.palette.statusActiveBg };
    case 'finalizado':
      return { border: t.palette.statusDoneBorder, bg: t.palette.statusDoneBg };
    case 'ausente':
      return { border: t.palette.statusNoshowBorder, bg: t.palette.statusNoshowBg };
    case 'cancelado':
      return { border: t.palette.statusCancelledBorder, bg: t.palette.statusCancelledBg };
  }
}

export function StatusChip({ status, active = false }: StatusChipProps) {
  const styles = useStyles();
  const { palette } = useTheme();
  const { border, bg } = getStatusColors({ palette } as ResolvedTheme, status);

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: bg },
        active && { borderWidth: 1, borderColor: border },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: border }]} />
      <Text style={[styles.label, { color: border }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
    gap: t.spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
  },
}));
