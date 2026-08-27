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

- [ ] 8. Flujo seguro de invitación/provisión de workers (`auth.users` + `worker_id`)
  - Diseñar sin exponer service-role en móvil (Edge Function con SECURITY DEFINER o invitación por email).
  - _R6_

- [ ] 9. ABM de trabajadores: alta/edición/baja lógica, validación de comisión, sync
  - Depende de tarea 8.
  - _R6_

- [x] 10. ABM de clientes: búsqueda local, validación y sync
  - Modelo/repositorio offline-first (`clientRepository.ts`) + UI (`ClientForm.tsx`, rutas `clients/*`), búsqueda local por nombre (`filterClientsByName`), validación con `validateClient`, aislamiento `business_id` y owner-only. `tsc` y `npm run build` en verde.
  - _Pendiente asociado: validación E2E (alta offline, pull en otro dispositivo) en tarea 13._
  - _R7_

- [ ] 11. Agenda diaria: crear/ver/editar/cancelar turnos + validación remota de slot
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
