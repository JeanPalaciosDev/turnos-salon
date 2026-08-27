# Requisitos — MVP Gestor de Turnos

## Introducción

App móvil offline-first para que un salón gestione su operación diaria: servicios,
trabajadores, clientes, agenda, cobros y comisiones. Un salón es un negocio
(`business_config`) con un owner y sus workers. La sincronización es server-wins sobre
Supabase (PostgreSQL + RLS + Edge Functions) y la base local es WatermelonDB/SQLite.

Este documento define los requisitos del MVP. El estado de avance por tarea vive en
`tasks.md`; las decisiones técnicas en `design.md`.

## Glosario

- **Owner**: dueño del negocio, acceso total.
- **Worker**: profesional, ve solo su propia agenda y su propio registro.
- **Ámbito (scope)**: combinación cuenta/negocio/rol/worker que determina qué datos viven
  localmente. Cambiar de ámbito reinicia la base local.
- **sync_version**: cursor monotónico global asignado por PostgreSQL para el pull.

## Requisitos

### R1 — Autenticación y sesión

**Historia:** Como usuario del salón, quiero iniciar sesión con email/password y que mi
sesión persista, para no tener que reautenticarme en cada uso.

Criterios de aceptación:
1. CUANDO un usuario sin sesión abre la app ENTONCES el sistema DEBE mostrar sign-in/sign-up.
2. CUANDO un usuario inicia sesión correctamente ENTONCES el sistema DEBE persistir la sesión
   en `expo-secure-store` y restaurarla al reabrir la app.
3. CUANDO el token está por expirar ENTONCES el sistema DEBE refrescarlo según el estado de la app.
4. La app NUNCA DEBE incluir la service role key; solo la anon/publishable key.

### R2 — Onboarding del owner

**Historia:** Como primer usuario, quiero crear mi negocio al registrarme, para empezar a operar.

Criterios de aceptación:
1. CUANDO un usuario autenticado no tiene `user_profiles` ENTONCES el sistema DEBE dirigirlo al onboarding.
2. CUANDO el owner completa el onboarding ENTONCES el sistema DEBE crear `business_config` y el
   perfil owner en una transacción vía `bootstrap_owner_business`, tomando email y `auth.uid()` en el servidor.
3. CUANDO el perfil existe ENTONCES el sistema DEBE calcular el ámbito local y disparar un pull/push inicial.

### R3 — Sincronización offline-first

**Historia:** Como staff, quiero operar sin conexión y que mis cambios se sincronicen al recuperar red.

Criterios de aceptación:
1. La app NUNCA DEBE bloquear la operación por falta de red.
2. CUANDO hay cambios locales y red ENTONCES el sistema DEBE hacer push autenticado y luego pull
   incremental por `sync_version`.
3. CUANDO el servidor rechaza un cambio (ej. slot solapado) ENTONCES el sistema DEBE conservar el
   dato local y exponer el conflicto para resolución.
4. Las altas offline DEBEN usar UUID v7 generado en cliente y viajar en el bucket `created`.

### R4 — Privacidad entre cuentas y roles

**Historia:** Como dueño, quiero que ningún dato de mi salón quede expuesto a otra cuenta en el mismo dispositivo.

Criterios de aceptación:
1. CUANDO se cierra sesión o cambia el ámbito ENTONCES el sistema DEBE reiniciar la base local.
2. ANTES de reiniciar por cierre de sesión ENTONCES la UI DEBE pedir confirmación explícita.
3. Un worker SOLO DEBE recibir su propio perfil, su registro `workers` y sus appointments.
4. Un worker NO DEBE poder hacer push genérico de sync.

### R5 — ABM de servicios

**Historia:** Como owner, quiero administrar los servicios del salón offline-first.

Criterios de aceptación:
1. CUANDO el owner abre servicios ENTONCES el sistema DEBE listar activos e inactivos de forma reactiva.
2. CUANDO el owner crea/edita un servicio ENTONCES el sistema DEBE validar nombre, duración y precio,
   asignar `business_id` del perfil y solicitar sync sin bloquear.
3. La desactivación DEBE usar `is_active=false` y preservar historial (no borrado lógico).
4. Un worker NO DEBE poder abrir ni mutar las rutas de servicios.
5. Los montos DEBEN manejarse como enteros en unidad mínima.

### R6 — ABM de trabajadores

**Historia:** Como owner, quiero dar de alta trabajadores y vincular sus cuentas de forma segura.

Criterios de aceptación:
1. DEBE existir un flujo seguro de invitación/provisión de `auth.users` que NO exponga la service role en el móvil.
2. CUANDO el owner crea/edita un worker ENTONCES el sistema DEBE validar nombre y comisión (tipo y valor).
3. La baja DEBE ser lógica (`is_active`/`is_deleted`), preservando historial de comisiones.

### R7 — ABM de clientes

**Historia:** Como owner, quiero registrar y buscar clientes.

Criterios de aceptación:
1. CUANDO el owner busca un cliente ENTONCES el sistema DEBE filtrar localmente por nombre.
2. CUANDO crea/edita un cliente ENTONCES el sistema DEBE validar nombre y sincronizar.

### R8 — Agenda de turnos

**Historia:** Como owner, quiero crear/ver/editar/cancelar turnos con validación de solapamiento.

Criterios de aceptación:
1. CUANDO se crea o mueve un turno ENTONCES el sistema DEBE validar que no se solape con otro del mismo worker.
2. La base DEBE proteger slots activos con exclusión GiST y el sync DEBE validar el intervalo transaccionalmente.
3. Un worker DEBE ver solo su propia agenda y poder marcar completado vía `complete_own_appointment`.

### R9 — Cobros, comisiones y dashboard

**Historia:** Como owner, quiero registrar pagos, calcular comisiones y ver métricas.

Criterios de aceptación:
1. Un appointment DEBE admitir múltiples pagos con método y tipo de cambio histórico.
2. Las comisiones DEBEN calcularse en `@turnos/core` sobre pagos/turnos del período, convertidos a
   `base_currency` con el tipo de cambio guardado.
3. Solo el owner DEBE ver pagos, comisiones y dashboard.

### R10 — Calidad y release

**Historia:** Como equipo, queremos verificar el MVP antes de publicarlo.

Criterios de aceptación:
1. `packages/core` DEBE tener tests de validadores, solapamientos y permisos.
2. Los cambios de core/models DEBEN pasar `npm run build` y `npm run test`.
3. Los cambios de la app DEBEN pasar `npx tsc --noEmit`.
4. Las tareas E2E NO DEBEN declararse completas sin un development build validado en dispositivo.
