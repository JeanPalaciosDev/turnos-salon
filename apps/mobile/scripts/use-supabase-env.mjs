#!/usr/bin/env node
/**
 * Apunta apps/mobile/.env.local a Supabase local o al proyecto hospedado.
 *
 *   node scripts/use-supabase-env.mjs local    # usa la instancia de Docker
 *   node scripts/use-supabase-env.mjs hosted   # usa el proyecto de Supabase
 *
 * Solo reescribe EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY; el
 * resto del archivo se conserva. Nunca imprime el valor de la clave. Guarda el
 * archivo anterior como .env.local.bak. Solo usa la clave publicable (anon):
 * la service role / secret key jamás entra al bundle de la app.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const supabaseDir = resolve(mobileDir, '../../backend/supabase');
const envPath = join(mobileDir, '.env.local');

const target = (process.argv[2] ?? '').toLowerCase();
if (target !== 'local' && target !== 'hosted') {
  console.error('Uso: node scripts/use-supabase-env.mjs <local|hosted>');
  process.exit(1);
}

function runSupabase(args) {
  return execFileSync('npx', ['supabase', ...args], {
    cwd: supabaseDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/** Lee la URL de la API y la clave publicable de la instancia local en Docker. */
function readLocal() {
  const output = runSupabase(['status', '-o', 'env']);
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (match) values.set(match[1], match[2]);
  }
  const url = values.get('API_URL');
  const key = values.get('PUBLISHABLE_KEY') ?? values.get('ANON_KEY');
  if (!url || !key) {
    throw new Error(
      'No se encontraron API_URL y la clave publicable en "supabase status". ' +
        'Levanta la instancia local con "npm run db:start".'
    );
  }
  return { url, key };
}

/** Lee la clave publicable del proyecto hospedado vinculado. */
function readHosted() {
  const refPath = join(supabaseDir, '.temp', 'project-ref');
  if (!existsSync(refPath)) {
    throw new Error('No hay proyecto vinculado. Corre "supabase link" primero.');
  }
  const ref = readFileSync(refPath, 'utf8').trim();
  const keys = JSON.parse(
    runSupabase(['projects', 'api-keys', '--project-ref', ref, '-o', 'json'])
  );
  const publishable = keys.find((k) => k.type === 'publishable' || k.name === 'anon');
  if (!publishable?.api_key) {
    throw new Error('No se encontró la clave publicable del proyecto hospedado.');
  }
  return { url: `https://${ref}.supabase.co`, key: publishable.api_key };
}

const { url, key } = target === 'local' ? readLocal() : readHosted();

const previous = existsSync(envPath) ? readFileSync(envPath, 'utf8').split(/\r?\n/) : [];
if (existsSync(envPath)) copyFileSync(envPath, `${envPath}.bak`);

const managed = /^\s*EXPO_PUBLIC_SUPABASE_(URL|ANON_KEY)\s*=/;
const kept = previous.filter((line) => line.trim() !== '' && !managed.test(line));
const next = [
  ...kept,
  `EXPO_PUBLIC_SUPABASE_URL=${url}`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY=${key}`,
  '',
].join('\n');

writeFileSync(envPath, next);

console.log(`.env.local -> ${target} (${url})`);
console.log('Clave publicable escrita (valor oculto).');
console.log('Reinicia Metro con cache limpia: npx expo start --web -c');
