import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

export type OptionItem = {
  id: string;
  label: string;
  /** Metadato opcional (por ejemplo, duración del servicio o nombre de la moneda). */
  hint?: string;
};

type OptionPickerProps = {
  items: OptionItem[];
  selectedId: string;
  emptyLabel: string;
  onSelect: (id: string) => void;
};

/**
 * Selector simple táctil (chips). Evita agregar una librería de picker nueva y
 * reutiliza el patrón visual del tema. Componente compartido entre el formulario
 * de turnos y el onboarding (moneda / zona horaria).
 */
export function OptionPicker({ items, selectedId, emptyLabel, onSelect }: OptionPickerProps) {
  if (items.length === 0) {
    return <Text style={styles.emptyOption}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.optionList}>
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[styles.option, isSelected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {item.label}
            </Text>
            {item.hint ? (
              <Text style={[styles.optionHint, isSelected && styles.optionTextSelected]}>
                {item.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.control,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSoft,
  },
  optionText: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
    fontSize: 14,
  },
  optionHint: {
    color: colors.textMuted,
    ...typography.micro,
  },
  optionTextSelected: {
    color: colors.brandPrimary,
  },
  emptyOption: {
    color: colors.textMuted,
    ...typography.body,
  },
});
