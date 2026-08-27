# Diseño — App de Agenda para Salón de Belleza

Pautas de diseño del panel de staff/administración de turnos. Son la fuente de verdad de
identidad visual y UX. Respetarlas lo más posible en cualquier pantalla nueva. Si algo choca
con la realidad del sistema, se ajusta acá y se deja anotado, no se ignora.

> Adaptación de plataforma: el documento original se pensó con tokens CSS (`--token`) y patrones
> web (hover, focus rings, drag & drop de escritorio). El stack real es **Expo + React Native +
> `StyleSheet`** (sin Tamagui, ver `structure.md`). Los valores hex, la escala y los principios se
> conservan tal cual; se implementan como constantes de tema en JS/TS y estilos nativos. Donde
> haya un patrón exclusivo de web (hover), se traduce al equivalente táctil (`pressed`/`active`).

---

## 1. Filosofía de diseño

La usa el **staff del salón**, no el cliente final: recepción y profesionales que la miran horas,
muchas veces con las manos ocupadas o de un vistazo rápido entre citas. Debe sentirse **cálida como
el salón**, pero funcionar como herramienta de trabajo: legible a distancia, jerarquía clara de
estados, sin fatiga visual en turnos largos.

**Principio rector:** *"Agenda de recepción, no hoja de cálculo."* Cada cita es una tarjeta con
identidad (cliente, servicio, profesional, estado), no una celda anónima en una grilla corporativa.

Nada del típico SaaS azul-blanco-gris de calendarios genéricos. La paleta se inspira en materiales
reales de un spa: madera clara, arcilla, salvia, lino — no en gradientes digitales.

---

## 2. Paleta de colores

Definir como constantes de tema (ej. `apps/mobile/src/theme/colors.ts`) y consumir desde
`StyleSheet`. Nunca hardcodear hex sueltos en componentes.

### 2.1 Base (neutros cálidos)

| Token | Hex | Uso |
|---|---|---|
| `bgBase` | `#FBF7F2` | Fondo general de la app (lino cálido, no blanco puro) |
| `bgSurface` | `#FFFFFF` | Tarjetas, paneles, modales |
| `bgSunken` | `#F1EAE0` | Áreas hundidas: sidebar, celdas fuera de horario laboral |
| `borderSubtle` | `#E8DFD3` | Líneas de grilla, separadores de columnas de profesional |
| `borderStrong` | `#D8C9B8` | Bordes de inputs, tarjetas activas |
| `textPrimary` | `#3A2E28` | Texto principal (marrón café, nunca negro puro) |
| `textSecondary` | `#7A6A5E` | Metadatos: hora, duración, notas |
| `textMuted` | `#A79484` | Placeholder, texto deshabilitado |

### 2.2 Acento de marca

| Token | Hex | Uso |
|---|---|---|
| `brandPrimary` | `#8C6A56` | Botones primarios, día seleccionado, marca |
| `brandPrimaryPressed` | `#745644` | Estado `pressed`/`active` de botón primario (web: hover) |
| `brandSoft` | `#EDE1D3` | Fondos suaves de elementos de marca (chips, badges neutros) |
| `accentWarm` | `#B98D6F` | Realce de celdas de calendario, focus/press suaves |

### 2.3 Estados de cita (el sistema más importante de la app)

Cada estado debe reconocerse **de un vistazo, sin leer texto**: se usa como **borde lateral de
3–4px** en la tarjeta + fondo tenue. Nunca color sólido saturado que canse en turnos largos.

| Estado | Token | Hex borde | Hex fondo tenue | Significado |
|---|---|---|---|---|
| Confirmada | `statusConfirmed` | `#6B8E7B` (verde salvia) | `#EAF0EB` | Cliente confirmó asistencia |
| Pendiente | `statusPending` | `#C97B63` (terracota) | `#F7EAE5` | Reservada, sin confirmar |
| En curso | `statusActive` | `#8C6A56` (marrón marca) | `#F1E8DE` | La cita está sucediendo ahora |
| Completada | `statusDone` | `#A79484` (gris cálido) | `#F1EAE0` | Servicio finalizado |
| Cancelada | `statusCancelled` | `#B0453F` (rojo ladrillo) | `#F7E8E6` | Cancelada — se muestra tachada al 60% opacidad |
| No-show | `statusNoshow` | `#8B4F42` (marrón rojizo oscuro) | `#F2E4E0` | Cliente no llegó |
| Bloqueado/descanso | `statusBlocked` | rayado diagonal `#D8C9B8` sobre `bgSunken` | — | Horario no disponible (almuerzo, personal) |

**Regla dura:** nunca rojo/verde saturados de semáforo (`#FF0000`/`#00FF00`). Todos los estados
están desaturados ~30–40% respecto a su versión "pura" para convivir sin gritar en una grilla con
20+ citas visibles.

### 2.4 Accesibilidad de color
- Contraste texto/fondo mínimo 4.5:1 en todo texto de tarjeta (`textPrimary` sobre cada fondo de estado).
- El estado **nunca** se comunica solo por color: siempre acompañado de un ícono pequeño
  (✓ confirmada, ⏱ pendiente, ✕ cancelada, ● en curso) para daltonismo.

---

## 3. Tipografía

| Rol | Fuente | Uso |
|---|---|---|
| Display / títulos | **Fraunces** (serif con carácter, variable) | Nombre del salón, título de sección ("Agenda de hoy"), nombre de cliente en tarjeta expandida |
| UI / cuerpo | **Public Sans** o **Inter** | Botones, formularios, navegación, labels |
| Numérica / horarios | **Fraunces** compact o mono con `fontVariant: ['tabular-nums']` | Horas en grilla, duración, precios — deben alinear verticalmente |

### Escala tipográfica

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `textDisplay` | 28 | 600 | Título de página |
| `textH2` | 20 | 600 | Nombre de profesional (columna), fecha |
| `textH3` | 16 | 600 | Nombre de cliente en tarjeta |
| `textBody` | 14 | 400 | Texto general, servicio, notas |
| `textSmall` | 12 | 500 | Hora, duración, badges de estado |
| `textMicro` | 11 | 500 | Metadatos secundarios, timestamps |

Interlineado generoso (`lineHeight` 1.4–1.5 del tamaño) en todo: se lee a media distancia, no es
una tabla densa de spreadsheet. Las fuentes deben cargarse vía `expo-font` antes de usarlas.

---

## 4. Layout de la grilla de agenda

```
┌─────────────────────────────────────────────────────────┐
│  [Sal Bella]      ‹  Martes 26 Ago  ›      [+ Nueva cita]│
├──────┬──────────────┬──────────────┬──────────────┬─────┤
│ Hora │  Ana (color)  │  Marta       │  Julián       │     │
├──────┼──────────────┼──────────────┼──────────────┼─────┤
│ 9:00 │ ┌──────────┐ │              │ ┌──────────┐ │     │
│      │ │ M. López │ │  ░░ bloqueo  │ │ J. Pérez │ │     │
│ 9:30 │ │ Corte    │ │  ░░ almuerzo │ │ Barba    │ │     │
│      │ └──────────┘ │              │ └──────────┘ │     │
│10:00 │              │ ┌──────────┐ │              │     │
└──────┴──────────────┴──────────────┴──────────────┴─────┘
```

- **Columnas = profesionales**, cada una con un identificador de color sutil en el header (no el
  color de estado; es color de *persona*, de una paleta secundaria de 6 tonos pastel cálidos para
  diferenciar profesionales de un vistazo).
- **Filas = franjas horarias**, altura proporcional a la duración real del servicio (no todas las
  citas ocupan el mismo alto).
- Franjas fuera de horario laboral: `bgSunken` sin interacción.
- Hora actual: línea horizontal fina de 2px en `brandPrimary` cruzando toda la grilla (el "ahora"
  físico de una agenda de papel).

> Nota móvil: en pantallas angostas, la vista multi-columna de profesionales puede degradar a
> selector de profesional + columna única. Mantener la anatomía de tarjeta y la línea de "ahora".

### Tarjeta de cita — anatomía
```
┃ [ícono estado] 10:00 – 10:45        <- hora, textSmall, tabular
┃ María López                         <- textH3
┃ Corte + Color                       <- textBody, textSecondary
┃ [avatar cliente]  •  $45            <- opcional en vista expandida
```
Borde izquierdo de 3px = color de estado. `borderRadius: 12` (redondeado suave, sensación de ficha
física, no de bloque de software).

Recordatorio de dominio: los montos son **enteros en unidad mínima** (`4500` = $45,00). El `$45` es
solo presentación; formatear al render, nunca almacenar flotantes.

---

## 5. Componentes clave

| Componente | Notas de estilo |
|---|---|
| Botón primario | `brandPrimary`, radio 8, texto blanco, sombra suave `shadowColor #3A2E28`, opacidad ~0.12 |
| Botón secundario | Borde `borderStrong`, fondo transparente, texto `textPrimary` |
| Badge de estado | Fondo tenue del estado + texto del color de borde del estado, radio full (píldora) |
| Input de formulario | Fondo `bgSurface`, borde `borderSubtle`, foco `accentWarm` 2px |
| Modal (nueva cita / detalle) | Fondo `bgSurface`, radio 16, overlay `rgba(58,46,40,0.4)` (marrón, no negro) |
| Sidebar / navegación | Fondo `bgSunken`, ítem activo con barra lateral `brandPrimary` de 3px |
| Toast de confirmación | "Cita creada" / "Cita cancelada" — fondo del estado tenue, ícono a la izquierda |

---

## 6. Espaciado y bordes

Espaciado en base 4: `4 / 8 / 12 / 16 / 24 / 32 / 48`.

- Radios: `8` (inputs, botones) / `12` (tarjetas de cita) / `16` (modales, paneles grandes).
- Sombras: siempre suaves y cálidas (`shadowColor: #3A2E28`, opacidad `0.08–0.15`), nunca grises
  fríos ni negros puros — coherencia cálida incluso en la profundidad.

---

## 7. Movimiento (motion)

Minimalista y funcional, no decorativo — el staff necesita velocidad:
- Al arrastrar una cita a otro horario (drag & drop): la tarjeta se eleva levemente (sombra +,
  escala 1.02) y las celdas válidas se resaltan con `accentWarm` al 15% de opacidad.
- Cambio de estado (ej. confirmar): transición de color 150ms ease-out, sin rebote.
- Apertura de modal: fade + slide-up sutil de 200ms. Nada de animaciones largas: se usa docenas de
  veces por turno.

---

## 8. Voz y microcopy

- Tono directo y cálido, como la recepción del salón: **"Confirmar cita"**, no "Ejecutar acción".
  **"Sin citas para hoy — momento perfecto para un café"**, no "No hay resultados".
- Los estados se nombran como los diría el staff: *Pendiente, Confirmada, En curso, Completada,
  Cancelada, No-show* — nunca jerga técnica ("status: 0").
- Errores explican qué pasó y qué hacer: *"Este horario se superpone con otra cita de Ana. Elegí
  otro horario o reasigná la cita existente."*
- Idioma: español rioplatense, consistente con el resto de la app.

---

## 9. Elemento de firma

**La línea de "ahora"** cruzando la grilla en `brandPrimary`, y las **tarjetas de cita con borde
lateral de color + esquinas redondeadas tipo ficha**, son los dos elementos que hacen que esta
agenda se sienta como el libro de turnos físico de un salón — cálido y humano — en lugar de un
calendario de oficina genérico. Mantener esta identidad en cualquier pantalla nueva (reportes,
configuración, perfil de cliente).
