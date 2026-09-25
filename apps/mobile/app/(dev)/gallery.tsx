import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { createStyles, useTheme, COLOR_FAMILIES } from '../../src/theme';
import {
  Avatar,
  BackArrow,
  Button,
  Chip,
  ColorSwatch,
  Divider,
  FabButton,
  IconButton,
  LinkText,
  ServiceCountPill,
  ServiceTag,
  StatusChip,
  ToggleSwitch,
} from '../../src/components/atoms';
import {
  CurrencySelect,
  DurationField,
  FieldWithSuffix,
  FormFooter,
  FormGroup,
  FormHeaderRow,
  FormHint,
  FormInput,
  FormLabel,
  FormSelect,
  SearchInputBar,
  ToggleRow,
} from '../../src/components/forms';
import {
  FilterBar,
  ListItem,
  ListScreenHeader,
  QuickGrid,
  QuickList,
  StatCard,
} from '../../src/components/lists';
import {
  AppointmentCard,
  DayPill,
  DaySelectorRow,
  NowLine,
  WeekEmptyState,
  WeekNav,
} from '../../src/components/agenda';
import {
  ConfirmModal,
  ModalPanel,
  PickerCreateRow,
  PickerModalHeader,
  PickerOptionRow,
  ServiceOptionRow,
  Calendar,
  Clock,
} from '../../src/components/modals';
import {
  BrandBlock,
  DetailRow,
  DetailStatusBanner,
  HomeHeader,
  SectionHeading,
} from '../../src/components/detail';

/**
 * Fase 6 — Galería interna de componentes (/(dev)/gallery).
 * Todos los componentes y sus variantes en una sola pantalla, con controles de
 * tema (modo + 7 familias de color) para cazar cualquier color literal escapado
 * (Fase 5.3) sin recorrer las 27 rutas.
 */
export default function GalleryScreen() {
  const { mode, color, toggleMode, setColor } = useTheme();
  const styles = useStyles();

  // Estado local de demo para los componentes controlados.
  const [toggle, setToggle] = useState(true);
  const [chipSel, setChipSel] = useState('Todos');
  const [text, setText] = useState('');
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('30');
  const [dayIdx, setDayIdx] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pickSel, setPickSel] = useState('a');
  const [svcSel, setSvcSel] = useState(true);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Controles de tema */}
      <View style={styles.themeBar}>
        <Text style={styles.title}>Galería de componentes</Text>
        <View style={styles.themeControls}>
          <Chip label={mode === 'light' ? 'Claro' : 'Oscuro'} selected onPress={toggleMode} />
          <View style={styles.swatchRow}>
            {COLOR_FAMILIES.map((f) => (
              <ColorSwatch
                key={f.key}
                color={f.swatch}
                active={f.key === color}
                onPress={() => setColor(f.key)}
              />
            ))}
          </View>
        </View>
      </View>

      {/* Átomos */}
      <Section title="Átomos · Botones">
        <Button variant="primary" label="Primario" onPress={() => {}} />
        <Button variant="secondary" label="Secundario" onPress={() => {}} />
        <Button variant="danger-ghost" label="Peligro" onPress={() => {}} />
        <Button variant="primary" label="Deshabilitado" onPress={() => {}} disabled />
        <Row>
          <IconButton icon="✎" onPress={() => {}} />
          <IconButton icon="🗑" variant="danger" onPress={() => {}} />
          <BackArrow onPress={() => {}} />
        </Row>
      </Section>

      <Section title="Átomos · Chips y estados">
        <Row>
          <Chip label="Todos" selected={chipSel === 'Todos'} onPress={() => setChipSel('Todos')} />
          <Chip label="Activos" selected={chipSel === 'Activos'} onPress={() => setChipSel('Activos')} />
        </Row>
        <Row wrap>
          <StatusChip status="creado" active />
          <StatusChip status="pendiente" active />
          <StatusChip status="curso" active />
          <StatusChip status="finalizado" active />
          <StatusChip status="ausente" active />
          <StatusChip status="cancelado" active />
        </Row>
      </Section>

      <Section title="Átomos · Varios">
        <Row>
          <ToggleSwitch value={toggle} onValueChange={setToggle} />
          <Avatar name="Sol Medina" colorIndex={0} />
          <Avatar name="Nico Alba" colorIndex={1} />
          <ServiceCountPill count={3} />
        </Row>
        <Row wrap>
          <ServiceTag label="Corte + Color" />
          <ServiceTag label="Barba" removable onRemove={() => {}} />
        </Row>
        <Divider label="o" />
        <LinkText label="Enlace de ejemplo" onPress={() => {}} />
      </Section>

      {/* Formularios */}
      <Section title="Formularios">
        <FormGroup>
          <FormLabel label="Campo requerido" required />
          <FormInput value={text} onChangeText={setText} placeholder="Escribí algo" />
        </FormGroup>
        <FormGroup>
          <FormLabel label="Campo opcional" optional />
          <FormHint text="Tocá el campo para ver el estado focus (borde accentWarm)." />
        </FormGroup>
        <FormLabel label="Duración" />
        <DurationField hours={hours} minutes={minutes} onHoursChange={setHours} onMinutesChange={setMinutes} />
        <FieldWithSuffix value={text} onChangeText={setText} suffix="USD" placeholder="0,00" />
        <Row>
          <CurrencySelect value="USD" onPress={() => {}} />
        </Row>
        <FormSelect value="" placeholder="Selector vacío" onPress={() => {}} />
        <FormSelect value="Sol Medina" onPress={() => {}} avatar={{ name: 'Sol Medina', colorIndex: 0 }} />
        <SearchInputBar placeholder="Buscar..." />
        <ToggleRow label="Activo" value={toggle} onValueChange={setToggle} />
      </Section>

      {/* Listas */}
      <Section title="Listas" flush>
        <ListScreenHeader title="Servicios" count={3} />
        <FilterBar filters={['Todos', 'Activos', 'Inactivos']} selected={chipSel} onSelect={setChipSel} />
        <ListItem
          avatar={{ name: 'Rocío Fernández', colorIndex: 0 }}
          title="Rocío Fernández"
          subtitle="Última visita: 12 sep"
          badge={{ label: 'Activo', active: true }}
          trailing={<IconButton icon="✎" onPress={() => {}} />}
        />
        <ListItem
          title="Manicura"
          subtitle="40 min · $18,00 USD"
          badge={{ label: 'Inactivo', active: false }}
        />
      </Section>

      <Section title="Listas · Home">
        <Row>
          <View style={styles.flex1}>
            <StatCard label="Turnos hoy" value="5" onPress={() => {}} />
          </View>
          <View style={styles.flex1}>
            <StatCard label="Próximo" value="14:30" />
          </View>
        </Row>
        <QuickGrid
          items={[
            { label: 'Agenda', icon: '📅', onPress: () => {} },
            { label: 'Servicios', icon: '✂️', onPress: () => {} },
          ]}
        />
        <QuickList
          items={[
            { label: 'Trabajadores', icon: '💇', onPress: () => {} },
            { label: 'Clientes', icon: '🧑', onPress: () => {} },
          ]}
        />
      </Section>

      {/* Agenda */}
      <Section title="Agenda" flush>
        <WeekNav title="Sep 22 – 28, 2026" onPrev={() => {}} onNext={() => {}} onCalendar={() => {}} />
        <DaySelectorRow
          days={[
            { dayName: 'Lu', dayNumber: 22, hasTurnos: true },
            { dayName: 'Ma', dayNumber: 23 },
            { dayName: 'Mi', dayNumber: 24, hasTurnos: true },
            { dayName: 'Ju', dayNumber: 25 },
            { dayName: 'Vi', dayNumber: 26 },
            { dayName: 'Sa', dayNumber: 27 },
            { dayName: 'Do', dayNumber: 28 },
          ]}
          selectedIndex={dayIdx}
          todayIndex={0}
          onSelect={setDayIdx}
        />
        <View style={styles.agendaCards}>
          <AppointmentCard time="14:30" clientName="Rocío Fernández" serviceName="Corte + Color" status="confirmed" workerName="Sol Medina" colorIndex={0} onPress={() => {}} />
          <AppointmentCard time="16:00" clientName="Ana Gómez" serviceName="Manicura" status="pending" workerName="Nico Alba" colorIndex={1} />
          <AppointmentCard time="10:00" clientName="Marta Díaz" serviceName="Barba" status="active" colorIndex={2} />
          <AppointmentCard time="09:00" clientName="Cancelado" serviceName="Color" status="cancelled" />
        </View>
        <WeekEmptyState />
      </Section>

      {/* Detalle */}
      <Section title="Detalle" flush>
        <DetailStatusBanner status="pendiente" label="Pendiente" />
        <DetailRow label="Cliente" value="Rocío Fernández" />
        <DetailRow label="Nota" value="Sin especificar" muted />
        <DetailRow label="Servicios">
          <Row wrap>
            <ServiceTag label="Corte + Color" />
            <ServiceTag label="Barba" />
          </Row>
        </DetailRow>
        <SectionHeading title="Sección con acción" action={{ label: 'Ver todo', onPress: () => {} }} />
        <View style={styles.pad}>
          <HomeHeader greeting="¡Hola, Martina!" subgreeting="Así va tu día" />
          <BrandBlock />
        </View>
      </Section>

      {/* Pickers en línea */}
      <Section title="Pickers (filas)" flush>
        <PickerCreateRow label="Crear nuevo cliente" onPress={() => {}} />
        <PickerOptionRow label="Rocío Fernández" avatar={{ name: 'Rocío Fernández', colorIndex: 0 }} selected={pickSel === 'a'} onPress={() => setPickSel('a')} />
        <PickerOptionRow label="Sin asignar" selected={pickSel === 'b'} onPress={() => setPickSel('b')} />
        <ServiceOptionRow label="Corte + Color" price="$45,00 USD" duration="45 min" selected={svcSel} onPress={() => setSvcSel((v) => !v)} />
      </Section>

      {/* Modales / pickers (disparadores) */}
      <Section title="Modales y pickers pesados">
        <Button variant="secondary" label="Abrir ConfirmModal" onPress={() => setConfirmOpen(true)} />
        <Button variant="secondary" label="Abrir ModalPanel (Calendar)" onPress={() => setPanelOpen(true)} />
      </Section>

      {/* Calendar y Clock embebidos (no en modal, para verlos siempre) */}
      <Section title="Calendar (allowPast=false)">
        <Calendar onSelect={() => {}} onCancel={() => {}} onConfirm={() => {}} />
      </Section>
      <Section title="Clock (dos pasos)">
        <View style={styles.clockWrap}>
          <Clock onConfirm={() => {}} onCancel={() => {}} />
        </View>
      </Section>

      <View style={styles.bottomSpace} />

      {/* FAB flotante para verlo en contexto */}
      <FabButton onPress={() => {}} />

      {/* Modales controlados */}
      <ConfirmModal
        visible={confirmOpen}
        title="¿Eliminar servicio?"
        message="Esta acción no se puede deshacer."
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
      <ModalPanel visible={panelOpen} onClose={() => setPanelOpen(false)}>
        <PickerModalHeader title="Calendario" subtitle="Elegí una fecha" onClose={() => setPanelOpen(false)} />
        <Calendar onSelect={() => {}} onCancel={() => setPanelOpen(false)} onConfirm={() => setPanelOpen(false)} />
      </ModalPanel>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  flush = false,
}: {
  title: string;
  children: React.ReactNode;
  flush?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={flush ? undefined : styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ children, wrap = false }: { children: React.ReactNode; wrap?: boolean }) {
  const styles = useStyles();
  return <View style={[styles.row, wrap && styles.rowWrap]}>{children}</View>;
}

const useStyles = createStyles((t) => ({
  root: { flex: 1, backgroundColor: t.palette.bgBase },
  content: { paddingBottom: t.spacing.xxxl },
  themeBar: {
    padding: t.spacing.xl,
    gap: t.spacing.md,
    backgroundColor: t.palette.bgSurface,
    borderBottomWidth: 1,
    borderBottomColor: t.palette.borderSubtle,
  },
  title: {
    fontSize: t.typeScale.display.fontSize,
    lineHeight: t.typeScale.display.lineHeight,
    fontFamily: t.typeScale.display.fontFamily,
    color: t.palette.textPrimary,
  },
  themeControls: { gap: t.spacing.sm },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm },
  section: {
    marginTop: t.spacing.xl,
    gap: t.spacing.sm,
  },
  sectionTitle: {
    fontSize: t.typeScale.small.fontSize,
    lineHeight: t.typeScale.small.lineHeight,
    fontFamily: t.typeScale.small.fontFamily,
    color: t.palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: t.spacing.xl,
  },
  sectionBody: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.xl,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  rowWrap: { flexWrap: 'wrap' },
  flex1: { flex: 1 },
  pad: { paddingTop: t.spacing.md, gap: t.spacing.md },
  agendaCards: { paddingHorizontal: t.spacing.xl, gap: t.spacing.sm, paddingVertical: t.spacing.sm },
  clockWrap: { alignItems: 'center' },
  bottomSpace: { height: t.spacing.xxxl },
}));
