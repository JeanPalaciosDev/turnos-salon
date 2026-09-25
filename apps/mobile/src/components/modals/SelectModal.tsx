import React from 'react';
import { ScrollView } from 'react-native';

import { createStyles } from '../../theme';
import { ModalPanel } from './ModalPanel';
import { PickerModalHeader } from './PickerModalHeader';
import { PickerOptionRow } from './PickerOptionRow';

export interface SelectOption {
  value: string;
  label: string;
  subtitle?: string;
}

interface SelectModalProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

/**
 * Modal de selección única a partir de una lista de opciones. Reutiliza
 * ModalPanel + PickerOptionRow. Elegir una opción la confirma y cierra.
 */
export function SelectModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: SelectModalProps) {
  const styles = useStyles();

  return (
    <ModalPanel visible={visible} onClose={onClose}>
      <PickerModalHeader title={title} onClose={onClose} />
      <ScrollView style={styles.list}>
        {options.map((opt) => (
          <PickerOptionRow
            key={opt.value}
            label={opt.label}
            subtitle={opt.subtitle}
            selected={opt.value === selected}
            onPress={() => {
              onSelect(opt.value);
              onClose();
            }}
          />
        ))}
      </ScrollView>
    </ModalPanel>
  );
}

const useStyles = createStyles((t) => ({
  list: { marginHorizontal: -t.spacing.xl },
}));
