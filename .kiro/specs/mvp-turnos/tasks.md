# Plan de implementación — MVP Gestor de Turnos

> Fuente de verdad del avance. `[x]` = implementado en código y verificado según se indica.
> `[-]` = en progreso. `[ ]` = pendiente. Las tareas E2E no se marcan `[x]` sin validación en dispositivo.

## Fundaciones (Fase 1)

- [x] 1. Scaffolding del monorepo (Turborepo, core, models, Expo, Supabase), assets nativos y perfiles EAS
  - _Pendiente asociado: resolver `403` de upload EAS y validar binario nativo (ver tarea 16)._
  - _R10_

- [x] 2. Backend Supabase: schema, RLS, bootstrap y RPCs hasta `00008`
  - Migraciones aplicadas en instancia local; privacidad owner/worker probada en transacción con `ROLLBACK`.
  - _Pendiente asociado: deploy y E2E contra destino real (tarea 13)._
  - _R2, R4_

- [x] 3. WatermelonDB + sync: schema, adapter, cliente pull/push, Edge Function `sync`, RPCs y validación de slots
  - _Pendiente asociado: integración E2E crear offline → push → pull → rechazo de solapamiento (tarea 13)._
  - _R3, R8_

- [x] 4. Auth móvil: email/password, SecureStore, onboarding owner, scope de caché y shell por rol
  - _Pendiente asociado: validar en app instalada, confirmación de email en producción (tarea 13)._
  - _R1, R2, R4_

- [x] 5. ABM de servicios: listado reactivo, alta, edición, desactivación/reactivación, validación y sync
  - _Pendiente asociado: validación E2E owner vs worker, alta offline, pull en otro dispositivo (tarea 13)._
  - _R5_

- [x] 6. Sistema de diseño: tema central (`src/theme`) y fuentes locales
  - Paleta cálida, escala tipográfica y espaciado según `steering/design.md`; todas las pantallas actuales consumen tokens (sin hex sueltos, `tsc` en verde).
  - Fuentes Fraunces/Public Sans (OFL) en `assets/fonts/`, cargadas con `expo-font` en el layout raíz.
  - _Pendiente asociado: pre-bundlear fuentes vía config plugin y confirmar aplicación visual en development build (tarea 16)._
  - _R10_

## Calidad de dominio (ejecutable ahora, sin dispositivo)

- [x] 7. Tests unitarios de `packages/core`
  - [x] 7.1 Tests de validadores (`validateService`, `validateClient`, `validateWorker`)
  - [x] 7.2 Tests de solapamiento (`hasTimeOverlap`, `validateNoOverlap`) — `overlap.test.ts`
  - [x] 7.3 Tests de permisos owner/worker (`canView/CompleteAppointment` con aislamiento por `worker_id`; 10 funciones owner-only) — `permissions.test.ts`. Nota: son 12 funciones de permisos, no 13.
  - [x] 7.4 `npm run test` en `packages/core` con la suite en verde (verificado por el pipeline: tester + revisión de seguridad PASS)
  - _R10_

## Módulos funcionales

- [-] 8. Flujo seguro de invitación/provisión de workers (`auth.users` + `worker_id`)
  - En código: migración `00009_worker_provisioning.sql` con RPC `link_worker_profile` (SECURITY DEFINER, revalida owner del mismo business), Edge Function `functions/invite-worker/` que usa la service-role SOLO en el servidor (`SUPABASE_SERVICE_ROLE_KEY` de `Deno.env`) para `auth.admin.inviteUserByEmail` y luego vincula el perfil vía la RPC con el Bearer del owner. Módulo móvil `src/workers/inviteWorker.ts` (invoca la función, revalida `canManageWorkers`) + botón "Invitar cuenta" en `workers/[id]`. `tsc` en verde. La service-role NUNCA vive en el bundle móvil.
  - _Pendiente asociado (E2E, tarea 13): deploy de la función + migración, `supabase secrets set SUPABASE_SERVICE_ROLE_KEY`, definir el deep link `WORKER_INVITE_REDIRECT_URL` de set-password, y validar el envío real de email y creación de `auth.users` en dispositivo/destino real. No `[x]` hasta ese E2E._
  - _R6_

- [x] 9. ABM de trabajadores: alta/edición/baja lógica, validación de comisión, sync
  - Modelo local `WorkerModel` completado (getters/setters) + repositorio offline-first `workerRepository.ts` (alta con UUIDv7 en bucket `created`, edición, `setWorkerActive` como baja lógica que preserva historial de comisiones, `deleteWorker` con `is_deleted` para casos excepcionales), validación con `validateWorker` de `@turnos/core` + regla de `commission_currency` (null para percentage, ISO 3 letras para fixed_per_service, satisface el CHECK `workers_commission_currency_consistent`), aislamiento `business_id` y owner-only (`canManageWorkers`). UI `WorkerForm.tsx` (segmented percentage/fixed_per_service, moneda condicional) + rutas `workers/index|new|[id]` con tema de `src/theme`. `npm run build`, `npm run test` (43) y `tsc --noEmit` en verde.
  - _Pendiente asociado: validación E2E (alta offline → push → pull en otro dispositivo) en tarea 13._
  - _R6_

- [x] 10. ABM de clientes: búsqueda local, validación y sync
  - Modelo/repositorio offline-first (`clientRepository.ts`) + UI (`ClientForm.tsx`, rutas `clients/*`), búsqueda local por nombre (`filterClientsByName`), validación con `validateClient`, aislamiento `business_id` y owner-only. `tsc` y `npm run build` en verde.
  - _Pendiente asociado: validación E2E (alta offline, pull en otro dispositivo) en tarea 13._
  - _R7_

- [x] 11. Agenda diaria: crear/ver/editar/cancelar turnos + validación remota de slot
  - Modelo local `AppointmentModel` con getters/setters (patrón `_getRaw/_setRaw`). Repositorio offline-first `src/appointments/appointmentRepository.ts`: `observeAppointmentsForDay` (aislado por `business_id`, worker filtra `worker_id`), `createAppointment`/`updateAppointment` con UUID v7 en bucket `created`, `end_time` derivado de la duración del servicio (respeta checks HH:mm y start<end), `status='scheduled'` inicial, `syncVersion=0`; cancelación como `status='cancelled'` (NO `is_deleted`, libera el slot en la exclusión GiST). Validación local de solapamiento con `validateNoOverlap` de `@turnos/core` antes de escribir; el servidor revalida transaccionalmente al push. Preflight ONLINE opcional contra `functions/v1/validate-slot` (`preflightSlot`, usa el token del usuario, sin service role; devuelve null sin red). Permisos revalidados con `canCreateAppointment`/`canEditAppointment`/`canCancelAppointment`.
  - UI según `steering/design.md`: `app/(app)/appointments/index.tsx` grilla por profesional (columnas=workers, filas horarias), navegación de fecha + botón "Nueva cita", tarjeta de cita con **borde lateral de color de estado** (3px) + fondo tenue + ícono + hora `tabular-nums`, altura proporcional a la duración, y la **línea de "ahora"** (`brandPrimary` 2px) — los dos elementos de firma. En pantallas angostas degrada a selector de profesional + columna única. `AppointmentForm.tsx` (cliente/servicio/worker/fecha/hora, conflictos como error) + `new.tsx` y `[id].tsx` (editar/cancelar) con `Redirect` por permiso y `syncNow()` tras mutar. Rutas registradas en `app/(app)/_layout.tsx` y accesos en `home.tsx` (owner: agenda del día; worker: mi agenda).
  - Verificado: `npm run build` (4 paquetes OK) y `npm run test` (`@turnos/core` 43 tests en verde) desde la raíz; `npx tsc --noEmit` en `apps/mobile` en verde.
  - _Pendiente asociado: validación E2E (crear offline → push → pull → rechazo de solapamiento por GiST, preflight contra validate-slot en dispositivo) en tarea 13. No `[x]` de E2E aquí._
  - _R8_

- [ ] 12. Vista worker: agenda propia y transición `complete_own_appointment`
  - _R8_

## Validación end-to-end (requiere dispositivo / destino real)

- [ ] 13. Validación E2E de auth, sync y servicios contra Supabase
  - Happy path: sign-up owner → bootstrap → restaurar sesión → pull/push → sign-out con reset → login.
  - ABM servicios: alta offline → push → pull en otro dispositivo → edición → desactivación → reinicio.
  - Worker no puede abrir ni mutar rutas de servicios; servidor rechaza su push genérico.
  - _R1, R3, R4, R5_

## Fases 2–4

- [ ] 14. Cobros multi-método y vista semanal
  - _R9_

- [ ] 15. Comisiones y dashboard
  - _R9_

- [ ] 16. UX offline, resolución de conflictos, performance y release en stores
  - Incluye resolver el `403` de EAS, generar binario `development` y validar en Android/iOS.
  - _R10_

- [ ] 17. (Propuesta, futura) Asociación owner-worker por código numérico con TTL
  - **Diseño únicamente; no implementar hasta priorizar.** Alternativa/complemento al flujo de
    invitación por email (tarea 8: `00009_worker_provisioning.sql` + `functions/invite-worker/`).
    El owner genera un código numérico de 8 dígitos (aleatoriedad criptográfica server-side,
    `gen_random_bytes`), asociado a un `worker_id` y opcionalmente a un email/`user_id` esperado,
    con TTL configurable (default 15 min) y un solo código activo por worker. El invitado se
    registra por su cuenta (sign-up estándar, anon key) y redime el código desde su propia sesión
    vía RPC `SECURITY DEFINER` (sin service-role, a diferencia de `invite-worker`). Tabla nueva
    `worker_invite_codes` (solo hash del código, nunca el claro en reposo; sin RLS directa a
    clientes, solo vía RPC). Riesgos a mitigar: fuerza bruta (máx. intentos + TTL corto +
    rate-limit), expiración estricta server-side, single-use, anti-enumeración (error genérico
    idéntico para código inexistente/expirado/usado/no coincidente). Migración futura numerada
    después de la última aplicada al momento de implementar (no reutilizar `00009`). Requiere
    UI de generación (owner, con cuenta regresiva) y de redención (invitado, input numérico) y
    verificación E2E en dispositivo antes de marcarse `[x]`.
  - _R6_
