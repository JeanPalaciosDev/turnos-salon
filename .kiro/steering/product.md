# Producto — Gestor de Turnos/Citas para salones

Aplicación móvil offline-first para que salones/peluquerías gestionen turnos, servicios,
trabajadores, clientes, cobros y comisiones. Un salón = un negocio (`business_config`),
con un owner y sus workers.

## Roles

- **Owner**: acceso total. Administra servicios, trabajadores, clientes, agenda, cobros,
  comisiones y dashboard. Puede hacer push genérico de sync.
- **Worker**: solo ve su propia agenda y su propio perfil/registro. Puede marcar sus turnos
  como completados vía la RPC `complete_own_appointment`. No puede hacer push genérico.

## Principios de producto

- **Offline-first**: la app debe funcionar sin conexión. Los cambios se guardan localmente
  (WatermelonDB) y se sincronizan cuando hay red. Nunca bloquear la operación por falta de red.
- **Privacidad entre cuentas**: al cerrar sesión o cambiar de ámbito (cuenta/negocio/rol/worker)
  se reinicia la base local para no exponer datos de un salón a otra cuenta en el mismo dispositivo.
  Por eso hay que sincronizar antes de confirmar el cierre de sesión.
- **Montos como enteros** en la unidad mínima (ej: `5000` = $50,00). Nunca usar flotantes para dinero.
- **Server-wins** en sincronización: PostgreSQL asigna `sync_version` (cursor monotónico global);
  `updated_at` es solo auditoría.

## Estado del roadmap y forma de trabajo

El trabajo se gestiona con un **spec de Kiro** en `.kiro/specs/mvp-turnos/`:

- `requirements.md` — requisitos del MVP (R1–R10).
- `design.md` — arquitectura y estado real por área.
- `tasks.md` — **fuente de verdad del avance**; marcar el estado de cada tarea a medida que se
  completa (`[ ]` pendiente, `[-]` en progreso, `[x]` hecho). Las tareas E2E no se marcan `[x]`
  sin validación en dispositivo.

Antes de planear trabajo nuevo, consultar `tasks.md` y avanzar en orden. Mantenerlo actualizado
cuando una tarea cambie de estado.

Orden funcional recomendado: tests de core → validación E2E de auth/sync/servicios → flujo seguro
de provisión de workers → ABM de trabajadores → ABM de clientes → agenda diaria → vista worker →
cobros/semanal/comisiones/dashboard → UX offline → E2E/release.
