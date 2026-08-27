# Estructura y stack

Monorepo con Turborepo + npm workspaces (`packages/*`, `apps/*`, `backend/*`).
Node >= 20, npm 10.8.0. TypeScript estricto en todo el repo.

## Layout

```text
packages/
  core/          Lógica de dominio pura: tipos, validadores y permisos owner/worker.
                 Sin dependencias de RN/Supabase. Tests con Vitest.
  models/        Schema y modelos WatermelonDB (schema.ts, migrations.ts, index.ts).
apps/
  mobile/        Expo SDK 52 + React Native 0.76.9 + Expo Router.
    app/         Rutas: (auth), (onboarding), (app)/services, home.
    src/auth/    Sesión, perfil, bootstrap, UUID v7 (AuthProvider).
    src/database/ WatermelonDB, modelos locales, scope de caché y sync.
    src/services/ Repositorio y formulario offline-first de servicios.
    src/lib/     supabase.ts (cliente + SecureStore).
    eas.json     Perfiles EAS: development, preview, production.
backend/
  supabase/
    migrations/  00001–00008: schema, RLS, RPCs, sync y privacidad de workers.
    functions/   sync (pull/push autenticado) y validate-slot.
```

## Stack efectivo (no asumir otras libs)

- Estado auth: React Context (`AuthProvider`). **Zustand NO está instalado.**
- Caché remota: WatermelonDB + sync explícito. **React Query NO está instalado.**
- UI: componentes nativos + `StyleSheet`. **Tamagui NO está instalado.**
- Persistencia de sesión: `expo-secure-store`.
- IDs offline: **UUID v7 generados en cliente**.
- Testing: **Vitest** (previsto para `packages/core`).

Antes de introducir una dependencia nueva, verificar que no exista ya un patrón equivalente
y confirmarlo. No agregar librerías de estado, UI o data-fetching sin acuerdo previo.

## Comandos (desde la raíz salvo que se indique)

- `npm run build` — turbo build de todos los paquetes (core/models compilan TS real).
- `npm run test` — turbo test (Vitest en core).
- `npm run lint` — turbo lint.
- En `packages/core`: `npm run test` (o `test:watch`).
- En `apps/mobile`: `npm run assets:generate` para regenerar iconos/splash.

El `build` de `apps/mobile` y de Supabase no produce artefactos reales: dependen de EAS/CLI.
