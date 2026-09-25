import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';

interface QuickListItem {
  label: string;
  icon: string;
  onPress: () => void;
}

interface QuickListProps {
  items: QuickListItem[];
}

export function QuickList({ items }: QuickListProps) {
  const styles = useStyles();

  return (
    <View>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{item.icon}</Text>
          </View>
          <Text style={styles.label}>{item.label}</Text>
        </Pressable>
      ))}
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
  },
  rowPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: t.palette.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  label: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
}));
