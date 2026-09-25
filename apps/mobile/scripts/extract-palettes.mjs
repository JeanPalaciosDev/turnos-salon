// @ts-nocheck
/**
 * Extrae las 14 paletas (7 colores x 2 modos) del bundle de diseno
 * "Turnos Salon - Sistema de Diseno.html" y genera
 * apps/mobile/src/theme/palettes.generated.ts.
 *
 * Re-correr cuando el diseno se retoque:
 *   node apps/mobile/scripts/extract-palettes.mjs
 *
 * No edita nada mas. La fuente de verdad de estilos es el CSS del bundle;
 * este script NO inventa valores, solo transcribe lo que hay en el CSS.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const BUNDLE = join(REPO_ROOT, 'Turnos Salon - Sistema de Diseño.html');
const OUT = join(__dirname, '..', 'src', 'theme', 'palettes.generated.ts');

const COLORS = ['carmelita', 'morado', 'azul', 'rosa', 'verde', 'amarillo', 'naranja'];
const MODES = ['light', 'dark'];

/** Lee el documento HTML embebido (JSON escapado en una linea larga). */
function extractEmbeddedDoc(bundlePath) {
  const lines = readFileSync(bundlePath, 'utf8').split(/\r?\n/);
  const line = lines.find(
    (l) => l.length > 50000 && l.trimStart().startsWith('"<!DOCTYPE'),
  );
  if (!line) throw new Error('No se encontro el documento embebido en el bundle');
  return JSON.parse(line.replace(/,\s*$/, ''));
}

/** Parsea "--token:#hex;--token2:rgba(...);" en un objeto {token: value}. */
function parseDecls(block) {
  const out = {};
  for (const decl of block.split(';')) {
    const m = decl.match(/^\s*(--[a-z0-9-]+)\s*:\s*(.+?)\s*$/i);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Devuelve el cuerpo {..} del primer selector que matchea exactamente. */
function ruleBody(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? parseDecls(m[1]) : {};
}

function toCamel(token) {
  return token.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function buildPalettes() {
  const doc = extractEmbeddedDoc(BUNDLE);
  const css = doc.replace(/\s+/g, ' ');

  const rootLight = ruleBody(css, ':root'); // carmelita claro (base completa)
  const rootDark = ruleBody(css, '[data-theme="dark"]'); // overrides neutros oscuros

  const palettes = {};
  for (const color of COLORS) {
    for (const mode of MODES) {
      // Base: root (claro) + overrides de modo oscuro si aplica.
      let merged = { ...rootLight };
      if (mode === 'dark') merged = { ...merged, ...rootDark };

      // Overrides de familia de color (solo brand-*, accent-warm).
      if (color !== 'carmelita') {
        const colorSel =
          mode === 'dark'
            ? `[data-theme="dark"][data-color="${color}"]`
            : `[data-color="${color}"]`;
        merged = { ...merged, ...ruleBody(css, colorSel) };
      }

      const camel = {};
      for (const [tok, val] of Object.entries(merged)) camel[toCamel(tok)] = val;
      palettes[`${color}-${mode}`] = camel;
    }
  }
  return palettes;
}

function emit(palettes) {
  const keys = Object.keys(palettes);
  const tokenKeys = Object.keys(palettes[keys[0]]).sort();

  const header = `// AUTO-GENERADO por apps/mobile/scripts/extract-palettes.mjs — NO editar a mano.
// Fuente: CSS de "Turnos Salon - Sistema de Diseño.html". Re-correr el script si el diseño cambia.
/* eslint-disable */

export const PALETTE_MODES = ['light', 'dark'] as const;
export const PALETTE_COLORS = ${JSON.stringify(COLORS)} as const;

export type PaletteMode = (typeof PALETTE_MODES)[number];
export type PaletteColor = (typeof PALETTE_COLORS)[number];

/** Nombre de cada token de color, derivado del CSS (--kebab -> camel). */
export type PaletteToken =\n${tokenKeys.map((k) => `  | '${k}'`).join('\n')};

export type Palette = Record<PaletteToken, string>;

export const PALETTES: Record<\`\${PaletteColor}-\${PaletteMode}\`, Palette> = ${JSON.stringify(
    palettes,
    null,
    2,
  )} as const;

export function getPalette(color: PaletteColor, mode: PaletteMode): Palette {
  return PALETTES[\`\${color}-\${mode}\`];
}
`;
  writeFileSync(OUT, header, 'utf8');
  return { count: keys.length, tokens: tokenKeys.length };
}

const palettes = buildPalettes();
const { count, tokens } = emit(palettes);
console.log(`OK: ${OUT}`);
console.log(`Paletas: ${count} (esperado 14) — Tokens por paleta: ${tokens}`);
