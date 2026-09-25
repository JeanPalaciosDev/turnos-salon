import { View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuth } from '../src/auth/AuthProvider';
import { BrandBlock } from '../src/components/detail';
import { AppScreen } from '../src/components/AppScreen';
import { Button } from '../src/components/atoms';
import { createStyles } from '../src/theme';

/**
 * Pantalla 1 — Splash / inicio. Enruta según el estado real de sesión:
 * signed-out → login, needs-bootstrap → registro de negocio, ready → principal.
 */
export default function SplashScreen() {
  const { status, errorMessage, retry } = useAuth();
  const styles = useStyles();

  if (status === 'signed-out') {
    return <Redirect href="/(auth)/login" />;
  }

  if (status === 'needs-bootstrap') {
    return <Redirect href="/(auth)/bootstrap" />;
  }

  if (status === 'ready') {
    return <Redirect href="/(app)/owner" />;
  }

  // loading / configuration-error / error → mostrar la marca (y un retry en error).
  return (
    <AppScreen header={false}>
      <View style={styles.center}>
        <BrandBlock tagline={errorMessage ?? 'Cargando…'} />
        {status === 'error' || status === 'configuration-error' ? (
          <View style={styles.retry}>
            <Button variant="secondary" label="Reintentar" onPress={() => void retry()} />
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.xl },
  retry: { paddingHorizontal: t.spacing.xl, alignSelf: 'stretch' },
}));
