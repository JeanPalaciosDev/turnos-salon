# Plan de Implementación — Gestor de Turnos/Citas

## 1. Stack recomendado

| Capa | Elección | Por qué | Alternativa descartada |
|------|----------|---------|----------------------|
| Framework móvil | **Expo (React Native)** | Comparte lógica TS con web futura, un solo dev no necesita código nativo. Expo SDK simplifica build/distribución. | Flutter — requiere Dart, duplica toda la lógica de negocio, imposibilita reutilización directa con web. |
| Lenguaje | **TypeScript** | Dominio del dev, tipado estático para modelo de datos complejo, ecosistema compartido móvil/web. | — |
| Base de datos local | **WatermelonDB** | Diseñada para offline-first en React Native, lazy loading, sincronización con backend vía pull/push, rendimiento en listas grandes de turnos. [verificar estado de mantenimiento 2024-25] | SQLite directo (expo-sqlite) — requiere escribir capa de sync desde cero. |
| Motor de sincronización | **WatermelonDB Sync** (protocolo built-in) | Protocolo push/pull con timestamps, resolución de conflictos server-wins configurable, ya integrado con la DB local. | PowerSync [verificar pricing y límites free tier] — más maduro en sync pero agrega dependencia de servicio externo. |
| Backend | **Supabase** (PostgreSQL + Auth + Edge Functions) | Postgres como fuente de verdad, auth integrado, edge functions para lógica de sync, un solo servicio que cubre DB remota + auth + API. Reduce superficie de mantenimiento. | Backend custom (Fastify + Prisma) — más control pero más infra que mantener solo. |
| Base de datos remota | **PostgreSQL (via Supabase)** | Relacional, soporta bien el modelo de entidades con relaciones, jsonb para extensibilidad. | — |
| Autenticación | **Supabase Auth** | Integrado con el backend elegido, soporta email/password y magic link, RLS para multi-tenancy futura. | Firebase Auth — agrega dependencia de Google sin necesidad. |
| Gestión de estado | **Zustand + React Query (TanStack Query)** | Zustand para estado UI/local ligero, TanStack Query para cache de datos remotos y refetch post-sync. Mínimo boilerplate. | Redux Toolkit — overhead excesivo para un solo dev. |
| Capa de UI | **Tamagui** | Comparte componentes entre React Native y web con estilos compilados, buen rendimiento. [verificar estabilidad con Expo SDK 52+] | NativeWind — solo estilos, no da componentes cross-platform listos. |
| Testing | **Vitest (lógica core) + React Native Testing Library (UI)** | Vitest es rápido para el paquete de lógica pura TS. RNTL para tests de componentes. | Jest — más lento, Vitest comparte config con web futura. |
| Build/Distribución | **EAS Build + EAS Submit** | Pipeline de Expo para compilar y publicar en stores sin CI propio. OTA updates con expo-updates. | Fastlane — requiere configuración manual por plataforma. |

## 2. Arquitectura

### Capas y estructura del monorepo

```
packages/
  core/          → Lógica de negocio pura TS (cálculos de salario, validaciones, reglas de moneda, permisos)
  models/        → Esquemas WatermelonDB, tipos compartidos, migraciones
apps/
  mobile/        → Expo app, UI con Tamagui, consume core + models
  web/ (futuro)  → React app, Tamagui web, consume core + models
backend/
  supabase/
    migrations/      → SQL para schema (CREATE TABLE, RLS policies)
    functions/
      sync/          → Edge Function TS: endpoint push/pull para WatermelonDB
      validate-slot/ → Edge Function TS: valida unicidad de horario en conflictos
    config.toml      → Config local de Supabase CLI
```

### Reutilización móvil/web

El monorepo (Turborepo) expone `core` y `models` como paquetes internos. La app web futura importa directamente la lógica de dominio y solo reemplaza la capa de navegación y storage.

### Estrategia de sincronización offline

- **Modelo:** Server-wins con last-write-wins por campo (no por registro completo). WatermelonDB Sync usa `updated_at` como vector de versión.
- **IDs:** UUIDs v7 generados en cliente (timestamp-sortable, evita colisiones sin coordinación).
- **Conflicto en mismo turno desde dos dispositivos:** El servidor compara `updated_at`; el cambio más reciente gana. Para el caso crítico (dos personas asignan el mismo horario a distinto cliente), el endpoint de sync valida unicidad de slot y rechaza el push del perdedor con error específico que el cliente muestra.
- **Flujo:** Cliente acumula cambios locales → al recuperar red, push de cambios → servidor aplica y devuelve pull con cambios remotos → cliente mergea.
- **Soft deletes:** Todos los registros usan `is_deleted` flag; nunca se borran físicamente para no romper sync.

### RBAC

- Tabla `user_profiles` con `role: 'owner' | 'worker'` y FK a `worker_id`
- RLS policies: owner ve todo del negocio, worker solo appointments donde `worker_id` = su worker asignado
- En cliente: Zustand store expone `currentUser.role`, la UI esconde/muestra funcionalidades
- **Permisos worker:** solo ve su propia agenda y marca turnos como completados. No puede crear turnos, ni ver otros trabajadores, ni cobrar.
- **Permisos owner:** acceso total a todas las funcionalidades.

## 3. Modelo de datos

```typescript
// Montos siempre en enteros (centavos/unidad mínima) para evitar redondeo flotante
type MoneyAmount = {
  amount: number;        // entero, ej: 1500 = $15.00
  currency: string;      // ISO 4217: "ARS", "USD"
};

type BusinessConfig = {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
  updated_at: number;
};

type UserProfile = {
  id: string;            // = Supabase auth.uid
  business_id: string;
  role: 'owner' | 'worker';
  worker_id?: string;    // FK a Worker si role='worker'
  email: string;
  updated_at: number;
};

type Service = {
  id: string;
  business_id: string;
  name: string;
  duration_minutes: number;
  default_price: MoneyAmount;
  is_active: boolean;
  updated_at: number;
  is_deleted: boolean;
};

type Worker = {
  id: string;
  business_id: string;
  name: string;
  commission_type: 'percentage' | 'fixed_per_service';
  commission_value: number;  // porcentaje (ej: 40) o monto fijo en centavos
  commission_currency?: string; // solo si fixed_per_service
  is_active: boolean;
  updated_at: number;
  is_deleted: boolean;
};

type Client = {
  id: string;
  business_id: string;
  name: string;
  phone?: string;
  notes?: string;
  updated_at: number;
  is_deleted: boolean;
};

type Appointment = {
  id: string;
  business_id: string;
  date: string;          // ISO 8601 date "2025-03-15"
  start_time: string;    // "14:30"
  end_time: string;      // "15:00"
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  service_id: string;
  worker_id: string;
  client_id: string;
  notes?: string;
  updated_at: number;
  is_deleted: boolean;
};

// Un appointment puede tener múltiples pagos (ej: parte en efectivo, parte en transferencia)
type Payment = {
  id: string;
  business_id: string;
  appointment_id: string;
  amount: MoneyAmount;
  method: 'cash' | 'card' | 'transfer' | 'other';
  // Tasa de cambio al momento del cobro si la moneda del pago difiere de la moneda base del negocio
  exchange_rate?: number; // ej: 1 USD = 1200 ARS → 1200
  exchange_base_currency?: string;
  paid_at: number;       // timestamp
  updated_at: number;
  is_deleted: boolean;
};
```

### Decisiones de multi-moneda

Los montos se almacenan siempre en la moneda en que se cobró. El `exchange_rate` captura la tasa al momento exacto del pago. Los reportes de salario/comisión convierten todo a `base_currency` usando el `exchange_rate` guardado en cada Payment, nunca recalculando con tasa actual. Redondeo: truncar al entero tras multiplicar por rate (banker's rounding si se requiere precisión contable).

### Comisiones

Se calculan en `core/` sobre los Payments completados del período, aplicando `commission_type` del Worker. Si el pago está en moneda distinta a `base_currency`, se convierte primero con el `exchange_rate` del Payment.

## 4. Decisiones críticas

1. **WatermelonDB como DB local** — Acopla la estrategia de sync al protocolo de la librería. Si WatermelonDB pierde mantenimiento, migrar es costoso. Mitigación: la lógica de negocio vive en `core/` sin importar WatermelonDB.

2. **Server-wins en conflictos** — Simplifica enormemente la sync pero puede perder escrituras del usuario. Aceptable porque el caso típico es pocos dispositivos por negocio; si escala a múltiples operadores simultáneos, hay que agregar merge por campo.

3. **Montos como enteros en centavos** — Evita errores de punto flotante pero requiere disciplina en toda la capa de UI (dividir por 100 al mostrar, multiplicar al guardar). No cambiar después.

4. **UUID v7 generado en cliente** — Permite crear registros offline sin coordinación. No se puede migrar a IDs secuenciales después sin romper sync.

5. **Monorepo con paquete `core` separado** — Estructura la reutilización web futura desde día 1. El costo es configuración inicial de Turborepo, pero ahorra refactor masivo después.

## 5. Roadmap por fases

| Fase | Entregable | Criterio de terminado |
|------|-----------|----------------------|
| **1 — MVP operativo con auth y sync** | Auth (owner + worker), ABM de servicios/trabajadores/clientes, agenda diaria con creación/edición/cancelación de turnos, sync multi-dispositivo, RBAC funcional. | Un salón real opera: owner agenda turnos, worker ve su agenda desde su celular, datos sincronizan entre dispositivos. |
| **2 — Cobro y vista semanal** | Registro de pagos multi-método y multi-moneda por turno. Vista semanal de agenda. Filtrado por worker/cliente/servicio. | Se puede cobrar un turno en efectivo + transferencia, y ver la agenda filtrada por trabajador en vista semanal. |
| **3 — Salarios y dashboard** | Cálculo de comisión por trabajador por período. Dashboard con métricas: turnos del día/semana/mes, ingresos totales, distribución por servicio. | El dueño del salón ve cuánto debe a cada trabajador en el mes y el resumen de ingresos semanal. |
| **4 — Polish y stores** | UX offline robusta (indicadores, manejo de conflictos), testing E2E, performance, publicación en App Store y Google Play. | Build de producción instalado en devices reales. Flujo completo funcional. Publicado en stores. |
| **5 — Web client (futuro)** | App React web consumiendo `core` + `models`, con Tamagui web. Funcionalidades de Fase 1-2 replicadas. | Se accede desde navegador desktop y se opera la agenda igual que en móvil. |

## 6. Decisiones de requerimientos resueltas

- **Multi-tenancy:** Un solo negocio por instalación. `BusinessConfig` es singleton.
- **Turnos recurrentes:** No. Solo turnos individuales creados manualmente.
- **Quién opera:** Dueño (acceso total) + trabajadores con acceso limitado (solo su agenda, solo marcar completado).
- **Acceso:** Cada persona desde su propio celular. Auth individual + sync multi-dispositivo desde fase 1.
- **Comisiones:** Solo visibles para el dueño.

## 7. Task Breakdown detallado

### Task 1: Monorepo scaffolding + configuración base

- **Objetivo:** Crear estructura de monorepo con Turborepo, configurar packages/core, packages/models, apps/mobile (Expo), backend/supabase.
- **Guía:** `npx create-turbo@latest`, agregar Expo app con `npx create-expo-app`, configurar tsconfig paths entre packages. Instalar Tamagui en mobile.
- **Tests:** Verificar que `turbo build` compila todos los packages. Un componente Tamagui placeholder se renderiza en el simulador.
- **Demo:** La app Expo arranca en simulador mostrando una pantalla "Hello" con un componente Tamagui estilizado.

### Task 2: Supabase setup + schema + auth + RLS

- **Objetivo:** Configurar proyecto Supabase (local con CLI para dev), crear migraciones SQL con todas las tablas del modelo, configurar Auth y RLS policies para owner/worker.
- **Guía:** `npx supabase init`, crear migraciones SQL para cada tabla. RLS: owner accede a todo donde `business_id` coincide, worker solo a appointments/services donde `worker_id` = su perfil. Edge function placeholder para sync.
- **Tests:** Test con Supabase CLI local: crear user owner, crear user worker, verificar que queries respetan RLS (worker no ve appointments de otro worker).
- **Demo:** Desde Supabase Studio local, se pueden crear registros y verificar que las policies filtran correctamente por rol.

### Task 3: WatermelonDB setup + modelos locales + sync básico

- **Objetivo:** Instalar WatermelonDB en la app mobile, definir schemas/modelos que reflejen las tablas de Postgres, implementar sync adapter que conecta con Edge Function de Supabase.
- **Guía:** Definir schemas en `packages/models`, configurar WatermelonDB con SQLite adapter en Expo. Implementar Edge Function `sync` que recibe push (cambios locales) y devuelve pull (cambios remotos) siguiendo protocolo WatermelonDB Sync.
- **Tests:** Test unitario: crear un appointment local, simular push al servidor, verificar que llega a Postgres. Pull: crear dato en Postgres, verificar que sync lo baja al cliente.
- **Demo:** Crear un registro offline en la app, activar sync, verificar que aparece en Supabase Studio.

### Task 4: Auth flow en mobile + role-based navigation

- **Objetivo:** Implementar login/signup con Supabase Auth en la app. Tras login, detectar rol del usuario y mostrar navegación correspondiente (owner ve todo, worker ve solo su agenda).
- **Guía:** Usar `@supabase/supabase-js` con AsyncStorage para sesión persistente. Zustand store con `currentUser`, `role`, `workerId`. Stack navigator condicional por rol.
- **Tests:** Test: login como owner muestra tabs completos (agenda, clientes, servicios, trabajadores, cobros, dashboard). Login como worker muestra solo tab "Mi agenda".
- **Demo:** Dos usuarios logueados en distintos simuladores ven interfaces diferentes según su rol.

### Task 5: ABM de Servicios

- **Objetivo:** CRUD completo de servicios (crear, listar, editar, desactivar) con persistencia offline en WatermelonDB y sync.
- **Guía:** Pantallas en mobile: lista de servicios, formulario crear/editar. Validaciones en `core/` (nombre requerido, duración > 0, precio > 0). Operaciones sobre WatermelonDB, sync automático cuando hay red.
- **Tests:** Vitest en core: validaciones. RNTL: renderizado de lista, formulario. Integration: crear servicio offline, sync, verificar en Supabase.
- **Demo:** Owner crea servicio "Corte de pelo $5000", lo edita, lo desactiva. Aparece en otro dispositivo tras sync.

### Task 6: ABM de Trabajadores + vinculación con UserProfile

- **Objetivo:** CRUD de trabajadores. Al crear un trabajador, opción de invitarlo (crear UserProfile con rol worker vinculado).
- **Guía:** Similar a servicios. Campo extra: tipo de comisión y valor. Flujo de invitación: owner ingresa email → se crea user en Supabase Auth con rol worker → se vincula `worker_id`.
- **Tests:** Crear trabajador, invitar por email, verificar que el nuevo user puede loguearse y tiene rol worker con su worker_id asignado.
- **Demo:** Owner crea trabajadora "Laura", la invita. Laura se loguea desde otro celular y ve su interfaz de worker.

### Task 7: ABM de Clientes

- **Objetivo:** CRUD de clientes con búsqueda por nombre/teléfono.
- **Guía:** Lista con barra de búsqueda (filtro local sobre WatermelonDB query). Formulario crear/editar. Validaciones en core.
- **Tests:** Crear cliente, buscar por nombre parcial, editar teléfono, verificar sync.
- **Demo:** Owner busca "Mar" y aparece "María García". Crea nuevo cliente "Juan", aparece en otro dispositivo.

### Task 8: Agenda diaria — crear y ver turnos

- **Objetivo:** Pantalla de agenda del día con slots horarios. Crear turno asignando servicio + trabajador + cliente + horario. Validación de conflictos (no solapar turnos del mismo trabajador).
- **Guía:** Vista como timeline del día (lista de slots). Formulario de nuevo turno con selects de servicio/worker/client. Validación de overlap en `core/`: dado worker + date + start/end, verificar que no colisione con otro appointment activo.
- **Tests:** Vitest: función `validateNoOverlap()` con casos edge (turnos contiguos OK, solapados rechazados). RNTL: renderizar agenda con turnos mock. Integration: crear turno, verificar sync + RLS (worker solo ve los suyos).
- **Demo:** Owner crea turno "Laura - Corte - María - 14:00 a 14:45". Aparece en la agenda del día. Laura desde su celular ve ese turno en "Mi agenda".

### Task 9: Agenda diaria — editar, cancelar, completar turnos + vista worker

- **Objetivo:** Acciones sobre turnos existentes. Owner puede editar/cancelar. Worker solo puede marcar como completado sus propios turnos. Filtros por worker/servicio/cliente.
- **Guía:** Swipe actions o menú contextual en cada turno. Lógica de permisos en `core/`: `canEditAppointment(user, appointment)`. Filtros como dropdowns que modifican la query de WatermelonDB.
- **Tests:** Test permisos: worker no puede cancelar. Owner sí. Filtro por worker muestra solo sus turnos.
- **Demo:** Owner filtra por "Laura", ve solo sus turnos. Laura marca turno como completado desde su cel. Owner ve el cambio de estado tras sync.

### Task 10: Vista semanal de agenda

- **Objetivo:** Vista de agenda que muestra 7 días con indicadores de turnos por día/hora. Navegación entre semanas.
- **Guía:** Grid o lista agrupada por día. Cada día muestra resumen (cantidad de turnos, nombres). Tap en un día navega a vista diaria. Reutilizar queries de WatermelonDB con rango de fechas.
- **Tests:** Renderizar semana con turnos distribuidos. Navegar a semana siguiente. Tap en día abre vista diaria correcta.
- **Demo:** Owner ve la semana con indicadores visuales. Navega entre semanas. Toca un día y llega a la agenda diaria.

### Task 11: Vista de cobro — registro de pagos multi-método y multi-moneda

- **Objetivo:** Desde un turno completado, registrar pago. Soportar split (parte efectivo, parte transferencia). Ingresar monto en cualquier moneda configurada, con tasa de cambio manual si difiere de base_currency.
- **Guía:** Pantalla de cobro accesible desde turno completado. Lista de "líneas de pago" donde cada una tiene monto + moneda + método. Si moneda ≠ base_currency, campo para exchange_rate. Validación en `core/`: suma de pagos debe cubrir precio del servicio (permitir sub/sobre-pago con warning). Montos en centavos.
- **Tests:** Vitest: validar que suma de payments cubre el precio. Calcular equivalente en base_currency. RNTL: agregar múltiples líneas de pago. Integration: cobrar y verificar records de Payment en DB.
- **Demo:** Owner cobra turno de Laura: $3000 en efectivo + $2000 por transferencia. Se registra como pagado. Si cobra en USD con tasa 1200, se guarda amount=500 (5 USD en centavos) con exchange_rate=1200.

### Task 12: Cálculo de comisiones/salario por trabajador

- **Objetivo:** Pantalla (solo owner) que muestra por cada trabajador: turnos completados y cobrados en un período, monto total generado, comisión calculada.
- **Guía:** Lógica en `core/`: dado un worker + rango de fechas, obtener sus appointments completados con payments asociados. Convertir todos los montos a base_currency usando exchange_rate de cada payment. Aplicar commission_type/value del worker. Mostrar desglose en pantalla.
- **Tests:** Vitest: calcular comisión percentage (40% de $10000 = $4000). Fixed ($500 por servicio × 8 servicios = $4000). Caso multi-moneda: payment en USD convertido a ARS.
- **Demo:** Owner selecciona "Laura - Marzo 2025": ve 20 turnos, $150.000 generados, comisión 40% = $60.000.

### Task 13: Dashboard de métricas

- **Objetivo:** Pantalla (solo owner) con métricas: turnos hoy/semana/mes (total, completados, cancelados, no-show), ingresos por período, servicio más demandado, trabajador más activo.
- **Guía:** Funciones en `core/` que agregan datos de appointments + payments por rangos de fecha. UI con cards/gráficos simples (barras o números grandes). Queries sobre WatermelonDB local (datos ya sincronizados).
- **Tests:** Vitest: funciones de agregación con datos mock. RNTL: renderizado de dashboard con datos.
- **Demo:** Owner ve: "Hoy: 12 turnos (10 completados, 1 cancelado, 1 pendiente). Semana: $450.000 en ingresos. Servicio top: Corte. Worker top: Laura."

### Task 14: Manejo de conflictos de sync + UX offline

- **Objetivo:** Robustecer la experiencia offline: indicador de estado de conexión, cola de cambios pendientes, manejo de errores de sync (conflicto de slot rechazado), retry automático.
- **Guía:** Banner sutil cuando está offline. Badge con cantidad de cambios sin sincronizar. Si el server rechaza un push por conflicto de slot, mostrar alerta al usuario con opción de resolver (re-asignar horario). Retry con backoff exponencial.
- **Tests:** Simular offline → crear turno → reconectar → verificar sync. Simular conflicto de slot → verificar que se muestra error y el turno conflictivo se marca.
- **Demo:** Poner celular en modo avión, crear turnos, desactivar modo avión, ver cómo sincroniza. Simular conflicto y ver el mensaje de resolución.

### Task 15: Polish, testing E2E, y preparación para stores

- **Objetivo:** Testing end-to-end del flujo completo. Performance profiling. Configurar EAS Build para generar binarios de iOS y Android. App icon, splash screen, metadata para stores.
- **Guía:** Flujo E2E: signup owner → crear negocio → ABM → agendar semana → cobrar → ver comisiones → invitar worker → worker opera. Detox o Maestro para E2E [verificar compatibilidad con Expo]. EAS config para builds de producción.
- **Tests:** Suite E2E completa del happy path. Performance: lista de 500+ appointments no debe laggear.
- **Demo:** Build de producción instalado en device físico. Flujo completo funcional. Listo para submit a stores.
