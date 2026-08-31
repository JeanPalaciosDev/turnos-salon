# Diseño técnico — MVP Gestor de Turnos

> Este documento describe la arquitectura objetivo y el estado real de implementación.
> "Implementado" = existe código versionado. Las validaciones locales se indican explícitamente
> y no sustituyen pruebas en dispositivo o contra un proyecto Supabase alojado.

## Estado real por área

| Área | Estado | Alcance actual |
|---|---|---|
| Monorepo | Parcial | Turborepo + `@turnos/core` + `@turnos/models` + Expo + Supabase. Core y models compilan TS; móvil y Supabase dependen de EAS/CLI. |
| Dominio compartido | Parcial | Tipos, validadores y permisos owner/worker en `packages/core`. Faltan cobros, comisiones, dashboard y tests. |
| Esquema remoto | Validado localmente | Migraciones `00001`–`00008`. Falta deploy y validación contra proyecto alojado. |
| WatermelonDB/SQLite | En código | Schema, modelos y adapter. Base aislada por `business_id`, rol y `worker_id`. |
| Sync offline | Validado localmente | Cliente pull/push, Edge Function `sync`, RPCs y cursor global. Falta E2E en dispositivo. |
| Auth y onboarding | En código | Email/password, SecureStore, perfil/rol, onboarding owner, sync inicial. Falta validar en development build. |
| ABM servicios | En código | Owner lista/crea/edita/desactiva/reactiva. Falta E2E contra Supabase y offline en dispositivo. |
| Sistema de diseño | En código | Tema central (`src/theme`) con paleta cálida, escala tipográfica y espaciado según `steering/design.md`. Fuentes Fraunces/Public Sans locales cargadas con `expo-font`. Todas las pantallas actuales consumen tokens. Falta validar carga de fuentes en development build. |
| UI restante | Parcial | Workers, clientes y agenda diaria en código; la vista worker completa turnos propios vía RPC `complete_own_appointment` (online, no sync genérico). Faltan cobros, comisiones y dashboard. |
| Release | Parcial | TS, Expo, perfil EAS, assets y migraciones locales verificados. Sin tests, E2E ni binario validado. Upload EAS bloqueado por `403` histórico. |

## Stack efectivo

- Expo SDK 52 + React Native 0.76.9 + Expo Router. TypeScript estricto.
- WatermelonDB 0.28 + SQLite adapter. `@supabase/supabase-js` 2.112.4. `expo-secure-store`.
- `react-native-url-polyfill` + `react-native-get-random-values` (Supabase y UUID v7).
- Estado auth: React Context (`AuthProvider`). Sin Zustand, sin React Query, sin Tamagui.
- Testing: Vitest en `packages/core`.
- Distribución: EAS Build + `expo-dev-client` 5.0.20.

## Arquitectura

```text
packages/
  core/     dominio: tipos, validadores y permisos puros
  models/   schema y modelos WatermelonDB
apps/mobile/
  app/(auth) (onboarding) (app)/services  home
  src/auth   src/database   src/services   src/lib/supabase.ts
backend/supabase/
  migrations/ 00001–00008   functions/ sync, validate-slot
```

### Flujo de autenticación

1. La app lee `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` de `apps/mobile/.env.local`.
2. `AuthProvider` restaura la sesión de SecureStore y refresca el token según estado de la app.
3. Sin sesión → sign-in/sign-up por email/password.
4. Sesión sin `user_profiles` → onboarding; `bootstrap_owner_business` crea negocio y perfil en transacción.
5. Con perfil → calcula ámbito local, reinicia WatermelonDB si cambió, dispara pull/push contra `functions/v1/sync`.
6. Antes de cada sync posterior, refresca el perfil para detectar cambios de ámbito y purgar datos ajenos.
7. Al cerrar sesión, la UI confirma y borra la base local (sincronizar antes).

### Sincronización

- **Modelo:** server-wins. PostgreSQL asigna `sync_version` (cursor de pull); `updated_at` es auditoría.
- **IDs:** UUID v7 en cliente para altas offline.
- **Flujo:** cambios locales → push autenticado → servidor aplica/rechaza → pull posterior al cursor → merge.
- **Buckets:** altas locales viajan en `created`. `sendCreatedAsUpdated` activo solo para aplicar como
  creación las filas remotas que el servidor devuelve en `updated`.
- **Conflicto de slots:** exclusión GiST en DB + validación transaccional en sync. Falta UX de resolución.
- **Soft deletes:** `is_deleted` en services/workers/clients/appointments/payments. Desactivar servicio es `is_active=false`.

### RBAC

- `user_profiles.role` = `owner | worker`, con `worker_id` opcional.
- Owner: gestiona su negocio y hace push genérico. Repositorio/rutas revalidan `canManage*` antes de mutar.
- Worker: recibe solo su perfil/worker/appointments; sin push genérico; completa vía `complete_own_appointment`.
- Migraciones `00007`/`00008` aplican aislamiento en RLS directo y en `sync_pull` (`SECURITY DEFINER`).

## Sistema de diseño (UI)

Fuente de identidad visual: `.kiro/steering/design.md`. La implementación vive en `apps/mobile/src/theme/`.

- `colors.ts`: neutros cálidos, acento de marca, estados de cita (`border` + `bg` tenue), colores de
  persona para profesionales y overlays/sombra. Regla dura: sin rojo/verde de semáforo.
- `spacing.ts`: escala base 4, radios (`control`/`card`/`panel`/`pill`) y sombras cálidas.
- `typography.ts`: escala `display`…`micro` + `bodyStrong`. `fontFamilies` mapea cada peso a una
  familia estática propia (RN no aplica bien el eje `fontWeight` sobre una sola familia variable).
- `index.ts`: reexporta todo y expone un objeto `theme`.

Fuentes: Fraunces (display/números) y Public Sans (UI), TTF estáticos en `assets/fonts/` bajo OFL.
Se cargan con `useFonts` en `app/_layout.tsx`, que devuelve `null` hasta tenerlas listas; si fallan,
la app sigue con la fuente del sistema. Pendiente: pre-bundlear vía config plugin de `expo-font` en
`app.json` y confirmar la aplicación visual en un development build (Expo Go no es representativo).

Elementos de firma aún no implementados (dependen del módulo de agenda): tarjeta de cita con borde
lateral de color + esquinas tipo ficha, y la línea de "ahora" sobre la grilla.

## Modelo de datos

Entidades: `BusinessConfig`, `UserProfile`, `Service`, `Worker`, `Client`, `Appointment`, `Payment`.
Todas las sincronizadas incluyen `updated_at` y `sync_version`; las operativas usan `is_deleted` cuando aplica.

Decisiones vigentes:
- Montos como enteros en unidad mínima. El formulario muestra ejemplo `5000 = $50,00`.
- `Payment` admite múltiples líneas por appointment con tipo de cambio histórico.
- Comisiones se calculan en `core` sobre pagos/turnos del período, convertidos a `base_currency`.
- Un usuario pertenece a un único negocio (RPC bootstrap + `user_profiles.id` único).

## Riesgos conocidos

- WatermelonDB usa módulos nativos (SQLite/JSI): validar en development build, no en Expo Go.
- IP LAN de Supabase local puede cambiar; firewall debe permitir acceso privado del teléfono.
- El reset local al cambiar ámbito protege privacidad pero borra cambios no sincronizados (la UI lo advierte).
- Falta flujo seguro de provisión de workers; nunca meter service-role en el bundle.
- `app.json` contiene owner y `projectId` EAS; no revincular sin confirmación.
- Auditoría: vulnerabilidades transitivas cuya corrección exige saltos mayores (Expo 57 / RN 0.86). No `audit fix` sin plan.
- Upload EAS falló con `403` histórico; aislar red/cuenta antes de reintentar.
