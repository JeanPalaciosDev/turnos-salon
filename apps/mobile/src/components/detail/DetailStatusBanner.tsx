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

function getStatusColors(t: ResolvedTheme, status: AppointmentStatus): StatusColors {
  switch (status) {
    case 'creado':
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
      <Text style={[styles.label, { color: border }]}>{label}</Text>
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
  label: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
  },
}));
