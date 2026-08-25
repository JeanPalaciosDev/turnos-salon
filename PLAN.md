# Plan de implementación — Gestor de Turnos/Citas

> **Estado actualizado: 2026-08-25.** Este documento combina la arquitectura objetivo con el avance real del repositorio. “Implementado” significa que existe código versionado; no presupone que una migración, Edge Function o flujo móvil haya sido verificado en ejecución.

## 1. Estado real de implementación

| Área | Estado | Evidencia / alcance actual |
|---|---|---|
| Monorepo | Parcialmente implementado | Turborepo, `@turnos/core`, `@turnos/models`, Expo y Supabase están creados. Core y models tienen build TypeScript; el build móvil y el de Supabase son placeholders de EAS/CLI. |
| Dominio compartido | Implementado parcialmente | Tipos, validadores de servicios/clientes/trabajadores/solapamientos y permisos puros owner/worker en `packages/core`. Faltan cálculos de cobros, comisiones, dashboard y tests. |
| Esquema remoto | Implementado en código | Migraciones `00001`–`00006`: tablas, RLS, `sync_version`, bootstrap del owner, completado de turnos, sync y slots. Falta confirmar el estado de una instancia Supabase concreta. |
| WatermelonDB y SQLite | Implementado en código | Schema, modelos y adaptador SQLite configurados en `apps/mobile/src/database`; ServiceModel ya expone accesores tipados sobre los campos raw. |
| Sync offline | Implementado en código | Cliente Watermelon pull/push, Edge Function `sync`, RPCs `sync_pull`/`sync_push`, cursor global y protección de solapamientos. Falta prueba end-to-end. |
| Auth móvil y onboarding | Implementado en código | Email/password, sesión persistente en SecureStore, perfil/rol, bootstrap transaccional de owner, sincronización tras sesión y landing básica por rol. Requiere variables de entorno y Supabase operativo. |
| ABM de servicios | Implementado en código | Owner lista, crea, edita, desactiva y reactiva servicios de forma local; el repositorio valida/normaliza y solicita sync. Falta probarlo contra Supabase real y con datos offline. |
| UI de negocio restante | Pendiente | Faltan ABM de trabajadores/clientes, agenda, cobros, comisiones y dashboard. |
| Calidad y release | Pendiente | No hay tests, E2E, build nativo validado ni configuración EAS. Los assets declarados por Expo todavía deben existir antes de un build nativo. |

## 2. Stack efectivo

| Capa | Elección actual | Estado |
|---|---|---|
| Framework móvil | Expo SDK 52 + React Native 0.76.9 + Expo Router | Configurado |
| Lenguaje | TypeScript estricto | Configurado |
| Base local | WatermelonDB 0.28 + SQLite adapter | Configurado en código |
| Backend | Supabase: PostgreSQL, Auth, RLS y Edge Functions | Configurado en código |
| Cliente auth | `@supabase/supabase-js` 2.112.4 | Integrado en móvil |
| Persistencia de sesión | `expo-secure-store` 14.0.1 | Integrada en móvil |
| Compatibilidad RN | `react-native-url-polyfill` 2.0.0 + `react-native-get-random-values` 1.11.0 | Integrada para Supabase y UUID v7 |
| Estado de auth | React Context (`AuthProvider`) | Integrado; Zustand no está instalado |
| Caché remota | WatermelonDB + sync explícito | React Query no está instalado |
| UI | Componentes y `StyleSheet` nativos | Tamagui no está instalado; sigue siendo una opción futura, no una dependencia actual |
| Testing | Vitest previsto para core | Aún no hay archivos de test |
| Distribución | EAS Build previsto | No configurado ni verificado |

## 3. Arquitectura actual

```text
packages/
  core/                      lógica de dominio, tipos y permisos puros
  models/                    schema y modelos WatermelonDB
apps/
  mobile/
    app/
      (auth)/                sign-in y sign-up
      (onboarding)/          alta inicial de business/owner
      (app)/
        home                 shell autenticado y estado de sync
        services/            listado, alta y edición de servicios
    src/
      auth/                  sesión, perfil, bootstrap y UUID v7
      database/              WatermelonDB, modelos locales y sync
      services/              repositorio y formulario offline-first
      lib/supabase.ts        cliente Supabase y SecureStore
backend/
  supabase/
    migrations/              schema, RLS, RPCs y protocolo de sync
    functions/
      sync/                  Edge Function pull/push autenticada
      validate-slot/         Edge Function de consulta de conflicto
```

### Flujo de autenticación actual

1. La app lee `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` desde `apps/mobile/.env.local`.
2. `AuthProvider` restaura la sesión persistida en `expo-secure-store` y mantiene el refresh del token según el estado de la app.
3. Sin sesión, Expo Router muestra `sign-in` o `sign-up` por email/password.
4. Con sesión sin `user_profiles`, el usuario entra al onboarding. `bootstrap_owner_business` crea en una transacción `business_config` y el perfil owner; el email y el `auth.uid()` se toman en el servidor.
5. Con perfil, la app prepara la base WatermelonDB para esa identidad y dispara un pull/push inicial contra `functions/v1/sync`.
6. Al cerrar sesión, la UI pide confirmación explícita y borra la base local. Esto evita exponer datos de un salón a la siguiente cuenta en el mismo dispositivo; por ello se debe sincronizar antes de confirmar.

### Configuración por entorno

- Copiar `apps/mobile/.env.example` a `apps/mobile/.env.local` y cargar la URL/anon key de Supabase.
- La app deriva el endpoint de sync como `<SUPABASE_URL>/functions/v1/sync`.
- `127.0.0.1` sirve para simuladores configurados localmente, no para un teléfono físico: en ese caso se necesita una URL accesible desde el dispositivo o un proyecto alojado.
- La **service role key nunca pertenece a la app móvil**. Solo la anon/publishable key se expone al cliente y RLS/RPCs aplican la autorización.

### Estrategia de sincronización offline

- **Modelo:** server-wins. PostgreSQL asigna `sync_version`, una versión monotónica global usada como cursor de pull; `updated_at` es metadato de auditoría.
- **IDs:** UUID v7 generados en cliente para altas offline. El bootstrap y el ABM de servicios usan el mismo criterio.
- **Flujo:** cambios locales → push autenticado → servidor aplica o rechaza → pull de registros posteriores al cursor → merge WatermelonDB.
- **Buckets WatermelonDB:** las altas locales siguen viajando en `created`, que el RPC puede insertar. `sendCreatedAsUpdated` permanece activado solo para que el cliente aplique como creación las filas remotas que el servidor incremental devuelve en `updated` por no mantener historial por dispositivo.
- **Conflicto crítico:** la base protege slots activos con una exclusión GiST y el protocolo de sync valida el intervalo de forma transaccional. El cliente todavía debe incorporar UX específica para resolver un rechazo de slot.
- **Soft deletes:** services, workers, clients, appointments y payments usan `is_deleted`. La desactivación de un servicio usa `is_active=false` y preserva historial; no es un borrado lógico.

### RBAC: objetivo y estado efectivo

- `user_profiles` expresa `role: 'owner' | 'worker'` y opcionalmente `worker_id`.
- Owner puede gestionar datos de su negocio y realizar push genérico de sync. El repositorio y las rutas de servicios vuelven a comprobar `canManageServices(profile)` antes de mutar localmente.
- Worker solo recibe sus appointments y no puede hacer push genérico; la transición de completado está restringida a `complete_own_appointment`.
- **Brecha a resolver:** las RLS actuales permiten que un worker lea perfiles y trabajadores de su negocio, y el pull inicial devuelve esas colecciones. Por lo tanto, el objetivo histórico de “no ver otros trabajadores” no está plenamente aplicado a nivel de datos. Antes de publicar se deben ajustar conjuntamente RLS y `sync_pull` si ese requisito se mantiene.
- La UI actual diferencia owner/worker en el shell y protege el ABM de servicios; la navegación funcional restante llegará junto con agenda y ABM pendientes.

## 4. Modelo de datos

Las entidades operativas son `BusinessConfig`, `UserProfile`, `Service`, `Worker`, `Client`, `Appointment` y `Payment`. Todas las entidades sincronizadas incluyen `updated_at` y `sync_version`; las operativas además usan `is_deleted` cuando aplica.

Decisiones vigentes:

- Montos como enteros en unidad mínima para no usar flotantes. El formulario de servicios solicita precio en esa unidad y muestra el ejemplo `5000 = $50,00`.
- `Payment` permite múltiples líneas por appointment y conserva tipo de cambio histórico.
- Las comisiones se calcularán en `core` sobre pagos/turnos del período, convertidos a `base_currency` con el tipo de cambio guardado.
- Un usuario pertenece a un único negocio según la RPC de bootstrap y el `user_profiles.id` único. La tabla `business_config` no tiene por sí sola una restricción singleton global.

## 5. Roadmap por fases

| Fase | Entregable | Estado actual | Criterio de terminado |
|---|---|---|---|
| 1 — Fundaciones | Monorepo, core/models, Supabase, WatermelonDB y sync | Código base implementado; validación operativa pendiente | Build de paquetes, migraciones aplicadas y sync probado contra PostgreSQL local/hosted |
| 1 — Auth | Sesión owner/worker, bootstrap y acceso protegido | Base owner-first implementada; falta invitar/provisionar workers y pruebas reales | Owner se registra, crea negocio, restaura sesión y sincroniza desde un dispositivo |
| 1 — Operación | ABM de servicios/trabajadores/clientes y agenda diaria | Servicios implementado en código; el resto pendiente | Owner administra datos y agenda; worker ve su agenda con aislamiento verificado |
| 2 | Cobros, vista semanal y filtros | Pendiente | Se registran pagos multi-método y se consulta agenda semanal |
| 3 | Comisiones y dashboard | Pendiente | Owner calcula salarios y consulta métricas del negocio |
| 4 | UX offline, E2E, performance y stores | Pendiente | Build de producción probado en dispositivos y flujo E2E verde |
| 5 | Cliente web | Futuro | Operación equivalente de fases 1–2 en navegador |

## 6. Tasks concretas y siguiente orden

1. **Task 1 — Scaffolding:** estructura base completada. Pendiente resolver assets Expo y verificar un build nativo; Tamagui no forma parte de la implementación actual.
2. **Task 2 — Supabase:** schema, RLS, bootstrap y RPCs existen hasta la migración `00006`. Pendiente verificar una instancia actual con migraciones aplicadas y pruebas de RLS por rol.
3. **Task 3 — WatermelonDB + sync:** schema, adapter, cliente, Edge Function, RPCs y validación de slots están implementados. Pendiente integración end-to-end: crear offline, push, pull y rechazo de solapamiento.
4. **Task 4 — Auth móvil:** implementada la base email/password, SecureStore, onboarding owner y shell por rol. Pendiente validar contra Supabase real, contemplar confirmación de email de producción y diseñar una invitación segura de workers; nunca exponer service role en móvil.
5. **Task 5 — ABM de servicios:** implementado en código. Incluye listado reactivo de servicios activos/inactivos, alta, edición, desactivación/reactivación, validación y sincronización solicitada tras cada mutación. Pendiente validar con Supabase real: owner vs worker, alta offline, push, pull en otro dispositivo, conflictos y persistencia tras reiniciar.
6. **Task 6 — ABM de trabajadores:** siguiente módulo funcional. Requiere primero un flujo seguro de invitación/provisión de `auth.users`, vinculación de `worker_id` y RLS.
7. **Task 7 — ABM de clientes:** búsqueda local, validación y sincronización.
8. **Tasks 8–15 — Agenda, semanal, pagos, comisiones, dashboard, offline UX y stores:** pendientes.

## 7. Validación requerida antes de declarar un MVP operativo

- Configurar variables de entorno móviles sin commitear secretos.
- Arrancar/aplicar Supabase incluyendo migraciones `00001`–`00006`, y servir o desplegar las Edge Functions.
- Probar sign-up, login, recuperación de sesión, bootstrap, sign-out y cambio de cuenta en un development build.
- Probar el ABM de servicios: alta offline, reintento de sync, edición concurrente, desactivación/reactivación, pull en otro dispositivo y bloqueo de worker.
- Probar sync offline/online, conflictos de horario, RLS owner/worker y borrado local de datos al salir.
- Agregar pruebas de core para solapamientos, permisos y validadores ya existentes.
- Ejecutar `expo-doctor`, revisar las vulnerabilidades transitivas y crear configuración/validación EAS antes de una release.

## 8. Riesgos conocidos

- WatermelonDB usa módulos nativos; un development build es más representativo que Expo Go para validar SQLite/JSI.
- La app actual deriva la URL de Edge Functions de la URL de Supabase; dispositivos físicos no pueden usar directamente `127.0.0.1` del host.
- El reset de base local al cerrar sesión protege la privacidad, pero elimina cambios aún no sincronizados; la confirmación de UI lo comunica y el usuario debe sincronizar antes.
- Los assets `icon.png`, `splash-icon.png` y `adaptive-icon.png` referenciados en `app.json` deben existir antes de un build nativo.
- Las políticas actuales no cumplen de forma estricta la privacidad de trabajadores descrita originalmente; la corrección debe ser server-side, no solo visual.
