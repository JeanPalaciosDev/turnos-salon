# Reglas de trabajo

## Seguridad y secretos

- La **service role key NUNCA** va en la app móvil ni en el bundle. Solo la anon/publishable key
  se expone al cliente; RLS y RPCs aplican la autorización.
- No commitear secretos. Los `.env.local` quedan fuera de git. Para teléfono físico usar una URL
  LAN o alojada alcanzable desde el dispositivo, no `127.0.0.1`.
- No introducir una service-role key para resolver el aprovisionamiento de workers; diseñar un
  flujo seguro de invitación/provisión de `auth.users`.

## Dominio y datos

- Toda mutación de datos owner-only debe revalidar el permiso de `@turnos/core`
  (`canManageServices`, `canManageWorkers`, etc.) antes de escribir localmente.
- Montos en enteros (unidad mínima). Nunca flotantes.
- Soft deletes con `is_deleted` en services, workers, clients, appointments y payments.
  Desactivar un servicio es `is_active=false`, no un borrado lógico.
- Altas offline viajan en el bucket `created` de WatermelonDB. `sendCreatedAsUpdated` está activo
  solo para aplicar como creación las filas remotas que el servidor devuelve en `updated`.

## Migraciones y backend

- Las migraciones son la fuente de verdad del schema (`00001`–`00008`). No editar migraciones ya
  aplicadas; agregar una nueva numerada.
- Que exista una migración/función en el repo no significa que esté desplegada. No afirmar deploy
  sin verificarlo contra el destino real.

## Verificación

- Después de tocar `packages/core` o `packages/models`, correr `npm run build` y `npm run test`.
- Después de tocar la app, correr `npx tsc --noEmit` en `apps/mobile`.
- No declarar tareas E2E como completadas sin un development build en dispositivo: WatermelonDB
  usa SQLite/JSI y Expo Go no es representativo.
- No agregar tests automáticamente salvo que se pidan; sí crear/actualizar los explícitamente
  pendientes en `PLAN.md`/`PENDIENTES.md` cuando se trabaje en ellos.

## Dependencias

- No ejecutar `npm audit fix`, `--force` ni overrides sin un plan de actualización aislado.
  Las correcciones de `tar`/Expo/Metro implican saltos mayores (Expo 57 / RN 0.86) desde SDK 52.
- No hacer downgrade de `@nozbe/watermelondb`.

## Entorno (Windows / PowerShell)

- Shell PowerShell: separar comandos con `;` (no `&&`). Variables de entorno con `$env:NAME`.
- No arrancar procesos de larga duración (`expo start`, watchers) de forma bloqueante; indicárselos
  al usuario para que los corra manualmente.

## Documentación viva

El seguimiento se hace en el spec `.kiro/specs/mvp-turnos/tasks.md`. Actualizar el estado de cada
tarea (`[ ]`/`[-]`/`[x]`) cuando cambie. No marcar algo como validado (`[x]`) si solo existe en
código: las tareas E2E requieren validación en dispositivo. Si una decisión técnica cambia,
reflejarla en `design.md`.
