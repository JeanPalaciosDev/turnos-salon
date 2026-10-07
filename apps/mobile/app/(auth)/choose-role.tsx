import {Pressable, Text, View} from 'react-native';
import {router} from 'expo-router';

import {AppScreen} from '../../src/components';
import {BrandBlock} from '../../src/components/detail';
import {createStyles} from '../../src/theme';

/**
 * Pantalla de elección de rol post-registro. Aparece cuando el usuario
 * no tiene perfil (status === 'needs-bootstrap'). Dos caminos:
 * dueño de salón → bootstrap, profesional → link-worker.
 */
export default function ChooseRoleScreen() {
  const styles = useStyles();

  return (
    <AppScreen header={false}>
      <View style={styles.container}>
        <BrandBlock tagline="¿Cómo vas a usar la app?"/>

        <View style={styles.cards}>
          <Pressable
            style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/(auth)/bootstrap')}
            accessibilityRole="button"
          >
            <Text style={styles.cardIcon}>🏠</Text>
            <Text style={styles.cardTitle}>Soy dueño de un salón</Text>
            <Text style={styles.cardSubtitle}>
              Crea tu salón, agrega trabajadores y gestiona la agenda.
            </Text>
          </Pressable>

          <Pressable
            style={({pressed}) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push('/(auth)/link-worker')}
            accessibilityRole="button"
          >
            <Text style={styles.cardIcon}>✂️</Text>
            <Text style={styles.cardTitle}>Soy profesional</Text>
            <Text style={styles.cardSubtitle}>
              Ingresa el código que te dio el dueño del salón para vincularte.
            </Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const useStyles = createStyles((t) => ({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: t.spacing.xl,
    gap: t.spacing.xxl,
  },
  cards: {
    gap: t.spacing.lg,
  },
  card: {
    backgroundColor: t.palette.bgSurface,
    borderWidth: 1,
    borderColor: t.palette.borderSubtle,
    borderRadius: t.radius.card,
    padding: t.spacing.xl,
    gap: t.spacing.sm,
    alignItems: 'center',
    shadowColor: t.palette.shadowColor,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: t.palette.bgSunken,
    borderColor: t.palette.borderStrong,
  },
  cardIcon: {
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: t.typeScale.h3.fontSize,
    lineHeight: t.typeScale.h3.lineHeight,
    fontFamily: t.typeScale.h3.fontFamily,
    color: t.palette.textPrimary,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: t.typeScale.body.fontSize,
    lineHeight: t.typeScale.body.lineHeight,
    fontFamily: t.typeScale.body.fontFamily,
    color: t.palette.textSecondary,
    textAlign: 'center',
  },
}));
