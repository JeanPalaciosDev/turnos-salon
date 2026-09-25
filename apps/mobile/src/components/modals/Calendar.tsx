import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { createStyles } from '../../theme';
import { Button } from '../atoms';

interface CalendarProps {
  selected?: Date;
  onSelect: (date: Date) => void;
  /** Si false (default), deshabilita los días anteriores a hoy. */
  allowPast?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

type CalendarCell = {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
};

function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const cells: CalendarCell[] = [];

  // Días del mes anterior para completar la primera semana
  const startDow = firstDay.getDay(); // 0 = domingo
  for (let i = startDow - 1; i >= 0; i--) {
    const date = new Date(year, month, -i);
    cells.push({ date, day: date.getDate(), isCurrentMonth: false });
  }

  // Días del mes actual
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), day: d, isCurrentMonth: true });
  }

  // Días del mes siguiente para completar la última semana
  const remaining = 42 - cells.length; // 6 filas × 7 columnas
  for (let i = 1; i <= remaining; i++) {
    const date = new Date(year, month + 1, i);
    cells.push({ date, day: date.getDate(), isCurrentMonth: false });
  }

  return cells;
}

/**
 * Calendario mensual. allowPast=false deshabilita días anteriores a hoy (usar
 * para elegir fecha de un turno). allowPast=true habilita todos (para navegar
 * la agenda).
 */
export function Calendar({
  selected,
  onSelect,
  allowPast = false,
  onCancel,
  onConfirm,
}: CalendarProps) {
  const today = startOfDay(new Date());
  const initDate = selected ?? today;

  const [currentYear, setCurrentYear] = useState(initDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(initDate.getMonth());

  const styles = useStyles();
  const cells = buildCalendarCells(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  return (
    <View style={styles.container}>
      {/* Cabecera de mes */}
      <View style={styles.monthHeader}>
        <Pressable
          onPress={prevMonth}
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
          accessibilityLabel="Mes anterior"
          hitSlop={8}
        >
          <Text style={styles.navArrow}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Text>
        <Pressable
          onPress={nextMonth}
          style={({ pressed }) => [styles.navBtn, pressed && styles.navBtnPressed]}
          accessibilityLabel="Mes siguiente"
          hitSlop={8}
        >
          <Text style={styles.navArrow}>›</Text>
        </Pressable>
      </View>

      {/* Fila de nombres de días */}
      <View style={styles.weekRow}>
        {DAY_NAMES.map((name) => (
          <View key={name} style={styles.weekCell}>
            <Text style={styles.weekDayName}>{name}</Text>
          </View>
        ))}
      </View>

      {/* Grilla de días */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          const isSelected = selected !== undefined && isSameDay(cell.date, selected);
          const isToday = isSameDay(cell.date, today);
          const isPast = startOfDay(cell.date) < today;
          const isDisabled = !allowPast && isPast;

          return (
            <Pressable
              key={idx}
              onPress={isDisabled ? undefined : () => onSelect(cell.date)}
              disabled={isDisabled}
              style={[
                styles.dayCell,
                isSelected && styles.dayCellSelected,
                !isSelected && isToday && styles.dayCellToday,
                !cell.isCurrentMonth && styles.dayCellOtherMonth,
                isDisabled && styles.dayCellDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: isDisabled, selected: isSelected }}
            >
              <Text
                style={[
                  styles.dayText,
                  isSelected && styles.dayTextSelected,
                  !cell.isCurrentMonth && styles.dayTextOtherMonth,
                  isDisabled && styles.dayTextDisabled,
                ]}
              >
                {cell.day}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hint para días deshabilitados */}
      {!allowPast && (
        <Text style={styles.hint}>Los días anteriores a hoy están deshabilitados</Text>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerBtn}>
          <Button variant="secondary" label="Cancelar" onPress={onCancel} />
        </View>
        <View style={styles.footerBtn}>
          <Button variant="primary" label="Confirmar" onPress={onConfirm} />
        </View>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    gap: t.spacing.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.spacing.sm,
    marginBottom: t.spacing.xs,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: t.radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPressed: {
    backgroundColor: t.palette.bgSunken,
  },
  navArrow: {
    fontSize: t.typeScale.h2.fontSize,
    lineHeight: t.typeScale.h2.lineHeight,
    fontFamily: t.typeScale.h2.fontFamily,
    color: t.palette.textSecondary,
  },
  monthTitle: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: t.spacing.xs,
  },
  weekDayName: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%` as unknown as number,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellSelected: {
    backgroundColor: t.palette.brandPrimary,
    borderRadius: 20,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: t.palette.brandPrimary,
    borderRadius: 20,
  },
  dayCellOtherMonth: {
    opacity: 0.3,
  },
  dayCellDisabled: {
    opacity: 0.4,
  },
  dayText: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textPrimary,
  },
  dayTextSelected: {
    color: t.palette.btnPrimaryText,
  },
  dayTextOtherMonth: {
    color: t.palette.textMuted,
  },
  dayTextDisabled: {
    color: t.palette.textMuted,
  },
  hint: {
    fontSize: t.typeScale.micro.fontSize,
    lineHeight: t.typeScale.micro.lineHeight,
    fontFamily: t.typeScale.micro.fontFamily,
    color: t.palette.textMuted,
    textAlign: 'center',
    marginTop: t.spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
  },
  footerBtn: {
    flex: 1,
  },
}));
