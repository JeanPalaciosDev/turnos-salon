import React from 'react';
import { Text, View } from 'react-native';

import { Avatar } from '../atoms/Avatar';
import { createStyles } from '../../theme';

interface ListItemProps {
  avatar?: { name: string; colorIndex?: number };
  title: string;
  subtitle?: string;
  badge?: { label: string; active: boolean };
  trailing?: React.ReactNode;
}

export function ListItem({ avatar, title, subtitle, badge, trailing }: ListItemProps) {
  const styles = useStyles();

  return (
    <View style={styles.row}>
      {avatar && (
        <Avatar name={avatar.name} size={32} colorIndex={avatar.colorIndex ?? 0} />
      )}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? <BadgePill label={badge.label} active={badge.active} /> : null}
      {trailing ? <View>{trailing}</View> : null}
    </View>
  );
}

function BadgePill({ label, active }: { label: string; active: boolean }) {
  const styles = useBadgeStyles();
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
    backgroundColor: t.palette.bgSurface,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  subtitle: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textSecondary,
  },
}));

const useBadgeStyles = createStyles((t) => ({
  pill: {
    borderRadius: t.radius.pill,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  pillActive: {
    backgroundColor: t.palette.brandSoft,
  },
  pillInactive: {
    backgroundColor: t.palette.bgSunken,
  },
  label: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
  },
  labelActive: {
    color: t.palette.brandPrimary,
  },
  labelInactive: {
    color: t.palette.textMuted,
  },
}));
