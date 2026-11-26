import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { goHome } from '../../navigation/navigate';
import { createStyles } from '../../theme';
import { BackArrow } from '../atoms';

interface FormHeaderRowProps {
  title: string;
  onBack?: () => void;
}

export function FormHeaderRow({ title, onBack }: FormHeaderRowProps) {
  const styles = useStyles();
  const { status, profile } = useAuth();

  return (
    <View style={styles.row}>
      {onBack ? (
        <BackArrow onPress={onBack} />
      ) : (
        <View style={styles.spacer} />
      )}
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {onBack && status === 'ready' ? (
        <Pressable
          style={styles.home}
          onPress={() => goHome(profile?.role)}
          accessibilityLabel="Ir a la pantalla principal"
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.homeIcon}>🏠</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    paddingHorizontal: t.spacing.xl,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textPrimary,
  },
  spacer: {
    width: 44,
  },
  home: {
    width: 44,
    height: 44,
    borderRadius: t.radius.control,
    backgroundColor: t.palette.bgSunken,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeIcon: { fontSize: 22 },
}));
