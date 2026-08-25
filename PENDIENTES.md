# Estado y pendientes técnicos

> **Actualizado: 2026-08-25.** Este archivo separa el código que ya existe de la validación operativa que aún falta. No debe interpretarse que una migración o Edge Function está desplegada solo porque exista en el repositorio.
>
> **Build EAS actual:** después de tres rechazos `403` de subida, EAS aceptó el archivo y creó el build Android `a6616e7c-1f7f-4bca-957a-0db0bf31fdf5` con perfil `development`. El último estado comprobado es `IN_PROGRESS`; no hay APK disponible hasta que EAS lo compile y lo marque como terminado.

## Implementado en código

- [x] Monorepo con Turborepo, `@turnos/core`, `@turnos/models`, Expo y configuración Supabase.
- [x] Tipos de dominio, validadores de servicios/clientes/trabajadores/solapamientos y permisos puros owner/worker en `packages/core`.
- [x] Schema WatermelonDB, modelos y adaptador SQLite en `apps/mobile/src/database`.
- [x] Cliente WatermelonDB Sync autenticado con pull/push y cursor `sync_version`.
- [x] Edge Function `sync`, RPCs `sync_pull`/`sync_push` y migraciones de sync (`00004`–`00005`).
- [x] Restricción transaccional de solapamiento y Edge Function/RPC `validate-slot` (`00004`–`00006`).
- [x] Schema remoto, RLS, bootstrap de owner y `complete_own_appointment` en migraciones `00001`–`00003`.
- [x] Privacidad de workers en `00007`–`00008`: RLS y `sync_pull` limitan a un worker a su propio perfil y registro; el owner conserva la vista del negocio. La app reinicia el caché de un worker cuando cambia su ámbito o proviene de una instalación anterior.
- [x] Auth móvil base: email/password, sesión persistente en SecureStore, perfil/rol, onboarding del primer owner y shell autenticado por rol.
- [x] Configuración local del móvil en `apps/mobile/.env.local` contra Supabase local; la anon/publishable key se usa en móvil y la service role queda fuera de la app.
- [x] Aislamiento local al cambiar/cerrar sesión: la UI confirma el cierre y reinicia WatermelonDB para no exponer datos entre cuentas.
- [x] Assets nativos reproducibles: `icon.png`, `adaptive-icon.png` y `splash-icon.png` son PNG de 1024×1024 generados por `npm run assets:generate` desde `apps/mobile`.
- [x] Preparación de development build: `expo-dev-client` `5.0.20`, `apps/mobile/eas.json` con perfil `development` de distribución interna y proyecto EAS `@jeancydev/turnos-salon` vinculado. Las variables públicas de Supabase están configuradas como `Sensitive` para `development`; no existe todavía un binario instalado.
- [x] **ABM de servicios:** owner puede listar, crear, editar, desactivar y reactivar servicios en WatermelonDB. El repositorio asigna UUID v7, toma `business_id` del perfil autenticado, valida/normaliza nombre, duración, precio y moneda, y solicita sync sin bloquear el uso offline.

## Bloqueadores para validar el flujo actual

- [x] Crear `apps/mobile/.env.local` con una `EXPO_PUBLIC_SUPABASE_URL` y anon/publishable key locales válidas. Nunca agregar una service role key.
- [x] Confirmar la instancia Supabase local con migraciones `00001`–`00008` aplicadas.
- [x] Verificar que `functions/sync` y `functions/validate-slot` están servidas localmente: ambas responden `401` sin token, como corresponde.
- [x] Probar RLS y `sync_pull` de forma transaccional: worker recibe `1` perfil/worker propio; owner recibe la vista completa de su negocio. Los datos de prueba se hicieron `ROLLBACK`.
- [x] Preparar la configuración versionada de development build en `apps/mobile/eas.json`, el proyecto EAS y las variables `development` requeridas.
- [x] Vincular la cuenta/proyecto de Expo `@jeancydev/turnos-salon`; EAS resolvió las variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` y creó las credenciales Android remotas.
- [ ] Resolver el `403` de EAS al subir metadata y tarball. Dos intentos llegaron a comprimir el proyecto y fueron rechazados antes de registrar un build. El diagnóstico local confirmó HTTPS a Expo y ausencia de proxy/PAC WinHTTP; revisar permisos o verificación de la cuenta/proyecto EAS y una posible interferencia de VPN, DNS o red específica de la subida firmada antes de reintentar.
- [ ] Generar e instalar el development build en un teléfono Android físico. Usar una URL LAN alcanzable desde el dispositivo, no `127.0.0.1`, y reconstruir la app tras cambiar el entorno.
- [ ] Ejecutar en un development build el happy path: sign-up de owner → bootstrap del salón → restauración de sesión → pull/push → sign-out con reset local → login de nuevo.
- [ ] Validar el ABM de servicios end-to-end: alta sin conexión → reconexión/push → pull en otro dispositivo → edición → desactivación/reactivación → reinicio de app.
- [ ] Probar que un worker no puede abrir ni mutar las rutas de servicios y que el servidor rechaza su push genérico, usando el futuro flujo de provisión real.
- [ ] Validar el comportamiento de confirmación de email en el Supabase de destino. Localmente puede devolver sesión tras sign-up; producción puede requerir confirmación antes del bootstrap.
- [ ] Probar creación offline, reconexión, pull incremental y rechazo de dos slots solapados.

## Calidad, build y seguridad pendientes

- [ ] Crear tests unitarios de `packages/core` para validadores, solapamientos y permisos ya implementados. El log histórico de Vitest no encontró archivos de test.
- [ ] Agregar pruebas del repositorio de servicios con una base WatermelonDB de prueba o un development build: validación, tenant, `is_active` y tracking de cambios para sync.
- [x] Ejecutar typecheck de la app tras los cambios de privacidad y la preparación del development build; `npx tsc --noEmit` terminó correctamente. Falta validar un binario nativo porque WatermelonDB usa SQLite/JSI.
- [ ] Resolver o reintentar `npx expo-doctor` hasta completar los 18 chequeos. La ejecución del 2026-08-25 aprobó 16/18: el schema remoto devolvió HTML en vez de JSON y React Native Directory marca `@nozbe/watermelondb` como no probado en New Architecture; `@turnos/core` y `@turnos/models` no tienen metadatos públicos. No suprimir estas advertencias sin validar un development build.
- [x] Generar y verificar los assets referenciados en `apps/mobile/app.json`; Expo reconoce las tres rutas y los PNG son válidos.
- [ ] Resolver el upload `403`, luego configurar EAS Build/Submit y probar binarios en Android/iOS antes de planificar publicación.
- [ ] Planificar una actualización compatible de las dependencias vulnerables. `npm install` reportó **36** vulnerabilidades totales (21 moderadas, 13 altas y 2 críticas); `npm audit --omit=dev` reportó **31** de producción (18 moderadas, 12 altas y 1 crítica). La corrección de `tar` y de la cadena Expo requiere Expo `57.0.16`, y la de Metro/React Native requiere RN `0.86.3`: ambos son saltos mayores desde SDK 52/RN 0.76.9. La sugerencia para WatermelonDB es un downgrade a `0.25.5`, que no debe aplicarse. No ejecutar `npm audit fix`, `--force` ni overrides sin una migración aislada y validación nativa.

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
- `sync_pull` conserva el parámetro `p_migration` por compatibilidad con WatermelonDB. Supabase DB Lint lo informa como no usado, sin afectar el comportamiento ni la seguridad.
- EAS creó las credenciales Android remotas y cargó las variables `development`, pero no registró ningún build: los dos intentos fueron rechazados con `403` antes de la creación del job.

## Próxima sesión sugerida

1. Confirmar que la cuenta Expo puede subir builds y revisar cualquier verificación pendiente en el dashboard.
2. Desde una red sin VPN/proxy corporativo o con la configuración de DNS/proxy validada, reintentar una sola vez el upload EAS y confirmar que aparece un build en el dashboard.
3. Confirmar si el teléfono Android y la PC están en la misma LAN, conservar la URL LAN en `apps/mobile/.env.local`, comprobar firewall y acceso a `:54321` desde el teléfono.
4. Cuando el APK esté instalado, validar auth, bootstrap, sync y el ABM de servicios.
5. Diseñar el aprovisionamiento seguro de workers antes de implementar su ABM.
