import React from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '../../theme';

interface AvatarProps {
  name: string;
  size?: number;
  /** Índice 0-2 → personColors. */
  colorIndex?: number;
}

export function Avatar({ name, size = 40, colorIndex = 0 }: AvatarProps) {
  const { personColors, typeScale } = useTheme();
  const bg = personColors[colorIndex % 3];
  const initial = (name.charAt(0) || '?').toUpperCase();
  const fontSize = Math.round(size * 0.4);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize,
          lineHeight: size,
          color: '#FFFFFF',
          fontFamily: typeScale.h2.fontFamily,
          textAlign: 'center',
        }}
      >
        {initial}
      </Text>
    </View>
  );
}
