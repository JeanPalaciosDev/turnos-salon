# Estado y pendientes técnicos

> **Actualizado: 2026-08-25.** Este archivo separa el código que ya existe de la validación operativa que aún falta. No debe interpretarse que una migración o Edge Function está desplegada solo porque exista en el repositorio.

## Implementado en código

- [x] Monorepo con Turborepo, `@turnos/core`, `@turnos/models`, Expo y configuración Supabase.
- [x] Tipos de dominio, validadores de servicios/clientes/trabajadores/solapamientos y permisos puros owner/worker en `packages/core`.
- [x] Schema WatermelonDB, modelos y adaptador SQLite en `apps/mobile/src/database`.
- [x] Cliente WatermelonDB Sync autenticado con pull/push y cursor `sync_version`.
- [x] Edge Function `sync`, RPCs `sync_pull`/`sync_push` y migraciones de sync (`00004`–`00005`).
- [x] Restricción transaccional de solapamiento y Edge Function/RPC `validate-slot` (`00004`–`00006`).
- [x] Schema remoto, RLS, bootstrap de owner y `complete_own_appointment` en migraciones `00001`–`00003`.
- [x] Auth móvil base: email/password, sesión persistente en SecureStore, perfil/rol, onboarding del primer owner y shell autenticado por rol.
- [x] Configuración de cliente móvil en `apps/mobile/.env.example`; la anon key se usa en móvil y la service role queda fuera de la app.
- [x] Aislamiento local al cambiar/cerrar sesión: la UI confirma el cierre y reinicia WatermelonDB para no exponer datos entre cuentas.
- [x] **ABM de servicios:** owner puede listar, crear, editar, desactivar y reactivar servicios en WatermelonDB. El repositorio asigna UUID v7, toma `business_id` del perfil autenticado, valida/normaliza nombre, duración, precio y moneda, y solicita sync sin bloquear el uso offline.

## Bloqueadores para validar el flujo actual

- [ ] Crear `apps/mobile/.env.local` desde `.env.example` con una `EXPO_PUBLIC_SUPABASE_URL` y anon key válidas. Nunca agregar una service role key.
- [ ] Confirmar que Supabase tiene aplicadas **todas** las migraciones `00001`–`00006`, no solo las tres iniciales.
- [ ] Iniciar/servir o desplegar `functions/sync` y `functions/validate-slot`; el cliente deriva sync como `<SUPABASE_URL>/functions/v1/sync`.
- [ ] Ejecutar en un development build el happy path: sign-up de owner → bootstrap del salón → restauración de sesión → pull/push → sign-out con reset local → login de nuevo.
- [ ] Validar el ABM de servicios end-to-end: alta sin conexión → reconexión/push → pull en otro dispositivo → edición → desactivación/reactivación → reinicio de app.
- [ ] Probar que un worker no puede abrir ni mutar las rutas de servicios y que el servidor rechaza su push genérico.
- [ ] Probar desde un teléfono físico con una URL accesible. `127.0.0.1` apunta al teléfono, no al host de desarrollo.
- [ ] Validar el comportamiento de confirmación de email en el Supabase de destino. Localmente puede devolver sesión tras sign-up; producción puede requerir confirmación antes del bootstrap.
- [ ] Probar creación offline, reconexión, pull incremental y rechazo de dos slots solapados.
- [ ] Probar RLS con owner y worker. La política/sync actuales todavía permiten que workers reciban perfiles y trabajadores del mismo negocio; decidir si esa exposición es aceptable o reducir RLS y `sync_pull`.

## Calidad, build y seguridad pendientes

- [ ] Crear tests unitarios de `packages/core` para validadores, solapamientos y permisos ya implementados. El log histórico de Vitest no encontró archivos de test.
- [ ] Agregar pruebas del repositorio de servicios con una base WatermelonDB de prueba o un development build: validación, tenant, `is_active` y tracking de cambios para sync.
- [ ] Ejecutar un typecheck de la app y un development build nativo después de cada módulo; WatermelonDB usa SQLite/JSI y no debe darse por validado solo por el script `build` del monorepo.
- [ ] Reintentar `npx expo-doctor` cuando su chequeo remoto de esquema responda JSON válido.
- [ ] Crear los assets referenciados en `apps/mobile/app.json` (`icon.png`, `splash-icon.png`, `adaptive-icon.png`) antes de cualquier build nativo.
- [ ] Configurar EAS Build/Submit y probar binarios en Android/iOS antes de planificar publicación.
- [ ] Revisar las **32 vulnerabilidades** transitivas reportadas por `npm install` el 2026-08-25. No ejecutar `npm audit fix --force` sin revisar los cambios incompatibles.

## Backlog funcional, en orden recomendado

1. **Validación end-to-end de auth, sync y servicios:** completar el flujo contra Supabase antes de sumar más entidades.
2. **ABM de trabajadores:** definir antes un flujo seguro de invitación/provisión de `auth.users`; no usar la service role desde móvil.
3. **ABM de clientes:** búsqueda local, validación y sincronización.
4. **Agenda diaria:** crear/ver/editar/cancelar turnos y conectar la validación remota de slot.
5. **Vista worker:** agenda propia y transición `complete_own_appointment` mediante RPC.
6. **Cobros, vista semanal, comisiones y dashboard.**
7. **UX offline:** estado de red, cola visible, retry y resolución de conflictos de agenda.
8. **E2E, performance y release en stores.**

## Notas de veracidad de las validaciones históricas

- `npm run build` sí puede compilar los paquetes TypeScript, pero los scripts actuales de móvil y Supabase solo muestran mensajes sobre EAS/CLI; no prueban un binario ni un deploy.
- La presencia de migraciones, artefactos o logs anteriores no confirma que una base Supabase activa esté actualizada hoy.
- El seed es intencionalmente vacío; el onboarding real crea el primer negocio mediante `bootstrap_owner_business` con el JWT del usuario.
- `sendCreatedAsUpdated` permite que WatermelonDB aplique pulls incrementales del servidor, que devuelve filas remotas existentes en `updated` por no llevar historial por dispositivo. No transforma las altas locales: estas continúan en el bucket `created` que el RPC inserta.

## Próxima sesión sugerida

1. Configurar una instancia Supabase y las variables locales de móvil.
2. Validar end-to-end auth, bootstrap, sync y el ABM de servicios en un development build.
3. Corregir las políticas de privacidad de worker si el requisito de no listar otros trabajadores sigue vigente.
4. Diseñar el aprovisionamiento seguro de workers antes de implementar su ABM.
