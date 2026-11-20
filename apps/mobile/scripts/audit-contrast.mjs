// @ts-nocheck
/**
 * Guardarraíl de contraste: mide los pares de color que la UI usa de verdad,
 * sobre las 14 paletas, contra los umbrales WCAG que exige design.md §2.4.
 *
 *   node apps/mobile/scripts/audit-contrast.mjs
 *
 * Sale con código 1 si aparece un fallo NUEVO, para que rompa el build igual
 * que validate-palettes.mjs. Los fallos ya conocidos viven declarados en
 * KNOWN_PENDING: se informan pero no rompen, y si uno empieza a cumplir el
 * script lo avisa para poder limpiar la lista.
 *
 * Contexto de por qué existe: el texto de los chips de estado usaba el color
 * del estado y caía a 2,44:1 en los 7 modos claros (28 de 84 comprobaciones).
 * Ver .kiro/knowledge/design-audit-2026-11.md.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEN = join(__dirname, '..', 'src', 'theme', 'palettes.generated.ts');

const AA_TEXT = 4.5;
// WCAG 1.4.11: elementos no textuales que transportan información (bordes, puntos).
const AA_NON_TEXT = 3.0;

const STATES = ['Confirmed', 'Pending', 'Active', 'Done', 'Cancelled', 'Noshow'];

/**
 * Pares que la UI usa hoy. Si un componente cambia de color, actualizar acá
 * para que el guardarraíl siga midiendo la realidad.
 */
function buildChecks() {
  const checks = [
    ['textPrimary', 'bgBase', AA_TEXT, 'texto principal sobre fondo'],
    ['textPrimary', 'bgSurface', AA_TEXT, 'texto principal sobre tarjeta'],
    ['textPrimary', 'bgSunken', AA_TEXT, 'texto principal sobre area hundida'],
    ['textSecondary', 'bgSurface', AA_TEXT, 'metadatos sobre tarjeta'],
    ['textMuted', 'bgSurface', AA_TEXT, 'placeholder sobre tarjeta'],
    ['btnPrimaryText', 'brandPrimary', AA_TEXT, 'texto del boton primario'],
  ];

  for (const s of STATES) {
    // StatusChip, DetailStatusBanner y el icono de AppointmentCard: todos
    // escriben en textPrimary sobre el fondo tenue del estado.
    checks.push([
      'textPrimary',
      `status${s}Bg`,
      AA_TEXT,
      `texto de estado ${s} sobre su fondo tenue`,
    ]);
    // El color del estado solo vive en el borde lateral y el punto.
    checks.push([
      `status${s}Border`,
      'bgSurface',
      AA_NON_TEXT,
      `borde de estado ${s} sobre tarjeta`,
    ]);
  }

  return checks;
}

/**
 * Fallos conocidos y aceptados a nivel paleta. Cada uno exige editar el CSS de
 * "Turnos Salon - Sistema de Diseño.html" y re-correr extract-palettes.mjs, o
 * sea cambiar la identidad visual: es decisión del dueño del producto, no del
 * código. Clave: "<etiqueta>|<paleta>".
 */
const KNOWN_PENDING = new Set([
  // Texto blanco sobre brandPrimary: falla en 6 de 7 paletas claras.
  // Oscurecimiento mínimo calculado en .kiro/knowledge/design-audit-2026-11.md.
  'texto del boton primario|morado-light',
  'texto del boton primario|azul-light',
  'texto del boton primario|rosa-light',
  'texto del boton primario|verde-light',
  'texto del boton primario|amarillo-light',
  'texto del boton primario|naranja-light',
  // textMuted (#A79484) sobre blanco = 2,91:1 en los modos claros.
  ...['carmelita', 'morado', 'azul', 'rosa', 'verde', 'amarillo', 'naranja'].map(
    (c) => `placeholder sobre tarjeta|${c}-light`
  ),
  // statusDoneBorder comparte el gris de textMuted: 2,91:1 sobre tarjeta.
  ...['carmelita', 'morado', 'azul', 'rosa', 'verde', 'amarillo', 'naranja'].map(
    (c) => `borde de estado Done sobre tarjeta|${c}-light`
  ),
]);

function srgbToLinear(channel) {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const h = String(hex).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return (
    0.2126 * srgbToLinear(parseInt(h.slice(0, 2), 16)) +
    0.7152 * srgbToLinear(parseInt(h.slice(2, 4), 16)) +
    0.0722 * srgbToLinear(parseInt(h.slice(4, 6), 16))
  );
}

function contrast(fg, bg) {
  const a = luminance(fg);
  const b = luminance(bg);
  if (a == null || b == null) return null;
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Mismo parseo que validate-palettes.mjs: el objeto PALETTES es JSON válido.
const src = readFileSync(GEN, 'utf8');
const objStart = src.indexOf('= {', src.indexOf('export const PALETTES'));
const objText = src.slice(src.indexOf('{', objStart), src.lastIndexOf('} as const;') + 1);

let palettes;
try {
  palettes = JSON.parse(objText);
} catch (e) {
  console.error(`FAIL: no se pudo parsear PALETTES: ${e.message}`);
  process.exit(1);
}

const checks = buildChecks();
const newFailures = [];
const pendingSeen = new Set();
let total = 0;

for (const [name, palette] of Object.entries(palettes)) {
  for (const [fgToken, bgToken, threshold, label] of checks) {
    const fg = palette[fgToken];
    const bg = palette[bgToken];
    if (!fg || !bg) {
      console.error(`FAIL: ${name} no tiene "${fgToken}" o "${bgToken}"`);
      process.exit(1);
    }
    const ratio = contrast(fg, bg);
    if (ratio == null) {
      console.error(`FAIL: color no hexadecimal en ${name} (${fgToken} / ${bgToken})`);
      process.exit(1);
    }
    total++;
    const key = `${label}|${name}`;
    const passes = ratio >= threshold;

    if (KNOWN_PENDING.has(key)) {
      pendingSeen.add(key);
      if (passes) {
        console.log(
          `LIMPIAR: "${key}" ya cumple (${ratio.toFixed(2)}:1). Quitarlo de KNOWN_PENDING.`
        );
      }
      continue;
    }

    if (!passes) {
      newFailures.push({ name, label, fgToken, bgToken, fg, bg, ratio, threshold });
    }
  }
}

const stale = [...KNOWN_PENDING].filter((k) => !pendingSeen.has(k));
if (stale.length > 0) {
  console.log(
    `AVISO: ${stale.length} entrada(s) de KNOWN_PENDING ya no se evalúan (¿cambió un par?):`
  );
  for (const k of stale) console.log(`   ${k}`);
}

if (newFailures.length > 0) {
  console.error(`\nFAIL: ${newFailures.length} fallo(s) de contraste NUEVO(s):\n`);
  for (const f of newFailures) {
    console.error(
      `  ${f.name}  ${f.label}\n` +
        `    ${f.fg} sobre ${f.bg} = ${f.ratio.toFixed(2)}:1 (minimo ${f.threshold}:1)\n` +
        `    tokens: ${f.fgToken} / ${f.bgToken}`
    );
  }
  console.error(
    '\nEl color de un estado NUNCA va como color de texto ni de icono: va en el\n' +
      'borde y el punto. El texto siempre en textPrimary (design.md §2.4).\n' +
      'Si el fallo es intencional y a nivel paleta, declararlo en KNOWN_PENDING\n' +
      'con su justificacion.'
  );
  process.exit(1);
}

console.log(
  `OK: ${total} comprobaciones de contraste sobre ${Object.keys(palettes).length} paletas; ` +
    `${pendingSeen.size} pendiente(s) declarado(s) a nivel paleta.`
);
