import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createStyles } from '../theme';
import { AppHeader } from './AppHeader';

/**
 * Contenedor base de pantalla (§6.1): fondo de la paleta activa, área segura
 * (el header va DEBAJO del inset del sistema — no dibujamos barra de estado),
 * header opcional y un slot para el FAB en posición absoluta.
 */
export function AppScreen({
  children,
  header = true,
  fab,
}: {
  children: React.ReactNode;
  /** Mostrar el AppHeader (🖌 + ●●●). Off en splash/login. */
  header?: boolean;
  /** Nodo del FAB, posicionado absoluto abajo-derecha por el CSS del propio FAB. */
  fab?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {header && <AppHeader />}
      <View style={styles.body}>{children}</View>
      {fab}
    </SafeAreaView>
  );
}

const useStyles = createStyles((t) => ({
  safe: { flex: 1, backgroundColor: t.palette.bgBase },
  body: { flex: 1 },
}));
