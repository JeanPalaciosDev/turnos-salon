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

interface DetailStatusBannerProps {
  status: AppointmentStatus;
  label: string;
}

type StatusColors = { border: string; bg: string };

/** Un glifo por estado (design.md §2.4); ○ y ● se distinguen por el relleno. */
const STATUS_ICON: Record<AppointmentStatus, string> = {
  creado: '○',
  pendiente: '⏱',
  curso: '●',
  finalizado: '✓',
  ausente: '⃠',
  cancelado: '✕',
};

function getStatusColors(t: ResolvedTheme, status: AppointmentStatus): StatusColors {
  switch (status) {
    // 'creado' tenía el mismo color que 'curso'; pasa al token confirmed, que
    // estaba sin usar, para que los 6 estados se distingan.
    case 'creado':
      return { border: t.palette.statusConfirmedBorder, bg: t.palette.statusConfirmedBg };
    case 'curso':
      return { border: t.palette.statusActiveBorder, bg: t.palette.statusActiveBg };
    case 'pendiente':
      return { border: t.palette.statusPendingBorder, bg: t.palette.statusPendingBg };
    case 'finalizado':
      return { border: t.palette.statusDoneBorder, bg: t.palette.statusDoneBg };
    case 'ausente':
      return { border: t.palette.statusNoshowBorder, bg: t.palette.statusNoshowBg };
    case 'cancelado':
      return { border: t.palette.statusCancelledBorder, bg: t.palette.statusCancelledBg };
  }
}

export function DetailStatusBanner({ status, label }: DetailStatusBannerProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { border, bg } = getStatusColors(theme, status);

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: bg,
          borderLeftColor: border,
        },
      ]}
    >
      <Text style={styles.label}>
        {STATUS_ICON[status]} {label}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  banner: {
    borderLeftWidth: 4,
    borderRadius: t.radius.card,
    paddingVertical: t.spacing.lg,
    paddingHorizontal: t.spacing.xl,
    marginHorizontal: t.spacing.xl,
    marginVertical: t.spacing.md,
  },
  // Igual que StatusChip: el color del estado vive en el borde, no en el texto.
  // Ese color sobre su propio fondo tenue caía a 2,44:1.
  label: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
}));
