// @ts-nocheck
/**
 * Verifica que palettes.generated.ts tenga exactamente 14 paletas y que TODAS
 * compartan el mismo conjunto de claves. Una paleta incompleta es un crash en
 * runtime al cambiar de tema, asi que este chequeo debe fallar el build/CI.
 *
 *   node apps/mobile/scripts/validate-palettes.mjs
 *
 * Sale con codigo 1 si algo no cuadra.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GEN = join(__dirname, '..', 'src', 'theme', 'palettes.generated.ts');

const EXPECTED_KEYS = [
  'carmelita-light', 'carmelita-dark',
  'morado-light', 'morado-dark',
  'azul-light', 'azul-dark',
  'rosa-light', 'rosa-dark',
  'verde-light', 'verde-dark',
  'amarillo-light', 'amarillo-dark',
  'naranja-light', 'naranja-dark',
];

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const src = readFileSync(GEN, 'utf8');
const objStart = src.indexOf('= {', src.indexOf('export const PALETTES'));
const objText = src.slice(src.indexOf('{', objStart), src.lastIndexOf('} as const;') + 1);
let palettes;
try {
  palettes = JSON.parse(objText);
} catch (e) {
  fail(`no se pudo parsear el objeto PALETTES: ${e.message}`);
}

const keys = Object.keys(palettes);
if (keys.length !== 14) fail(`se esperaban 14 paletas, hay ${keys.length}`);

for (const k of EXPECTED_KEYS) {
  if (!palettes[k]) fail(`falta la paleta "${k}"`);
}

const reference = Object.keys(palettes['carmelita-light']).sort();
if (reference.length === 0) fail('carmelita-light no tiene tokens');

for (const [name, pal] of Object.entries(palettes)) {
  const ks = Object.keys(pal).sort();
  if (ks.length !== reference.length || ks.some((k, i) => k !== reference[i])) {
    const missing = reference.filter((k) => !ks.includes(k));
    const extra = ks.filter((k) => !reference.includes(k));
    fail(
      `la paleta "${name}" no tiene las mismas claves que carmelita-light.` +
        (missing.length ? ` faltan: ${missing.join(', ')}.` : '') +
        (extra.length ? ` sobran: ${extra.join(', ')}.` : ''),
    );
  }
  for (const [tok, val] of Object.entries(pal)) {
    if (typeof val !== 'string' || !val.trim()) fail(`"${name}.${tok}" vacio o no-string`);
  }
}

console.log(`OK: 14 paletas, ${reference.length} tokens cada una, todas con las mismas claves.`);
