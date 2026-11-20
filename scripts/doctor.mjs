// @ts-nocheck
/**
 * Diagnóstico del entorno de desarrollo local. Un comando que responde "¿por
 * qué no funciona?" en vez de ir descubriéndolo a mano.
 *
 *   npm run doctor
 *
 * Sale con código 1 si hay algún fallo crítico. Cada hallazgo trae el comando
 * de arreglo. Nunca imprime claves ni contraseñas.
 *
 * Cubre los casos que costaron horas de diagnóstico (ver
 * .kiro/knowledge/local-dev-environment.md):
 *   - edge_runtime que `supabase start` no relevanta -> sync devuelve 500
 *   - migraciones del repo sin aplicar sobre un volumen existente
 *   - SCHEMA_VERSION local por delante del gate de sync_pull -> sync muerto
 *   - reloj del host desfasado -> "JWT issued at future"
 *   - puerto de Metro dentro de un rango reservado por Hyper-V
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import net from 'node:net';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_CONTAINER = 'supabase_db_turnos-salon';
const EDGE_CONTAINER = 'supabase_edge_runtime_turnos-salon';
const API = 'http://127.0.0.1:54321';
const METRO_PORT = Number(process.env.TURNOS_METRO_PORT ?? 19006);

const results = [];
const ok = (area, detail) => results.push({ level: 'ok', area, detail });
const warn = (area, detail, fix) => results.push({ level: 'warn', area, detail, fix });
const fail = (area, detail, fix) => results.push({ level: 'fail', area, detail, fix });

function sh(file, args, opts = {}) {
  return execFileSync(file, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

function psql(sql) {
  return sh('docker', ['exec', DB_CONTAINER, 'psql', '-U', 'postgres', '-At', '-c', sql]).trim();
}

// ---------------------------------------------------------------- Docker
let dockerUp = false;
try {
  const version = sh('docker', ['info', '--format', '{{.ServerVersion}}']).trim();
  dockerUp = Boolean(version);
  ok('docker', `daemon activo (${version})`);
} catch {
  fail(
    'docker',
    'el daemon no responde',
    'Start-Process "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"'
  );
}

// ---------------------------------------------------- Contenedores Supabase
let dbUp = false;
if (dockerUp) {
  let running = [];
  try {
    running = sh('docker', ['ps', '--filter', 'name=supabase', '--format', '{{.Names}}'])
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    /* sin contenedores */
  }

  if (running.length === 0) {
    fail(
      'supabase',
      'ningun contenedor corriendo',
      'cd backend/supabase ; npx supabase start'
    );
  } else {
    dbUp = running.includes(DB_CONTAINER);
    ok('supabase', `${running.length} contenedor(es): ${running.map((n) => n.replace('_turnos-salon', '')).join(', ')}`);

    // El gotcha estrella: start no relevanta un edge_runtime en Exited.
    if (!running.includes(EDGE_CONTAINER)) {
      let state = 'ausente';
      try {
        state = sh('docker', [
          'ps', '-a', '--filter', `name=${EDGE_CONTAINER}`, '--format', '{{.Status}}',
        ]).trim() || 'ausente';
      } catch {
        /* ignorar */
      }
      fail(
        'edge runtime',
        `no esta corriendo (${state}); las funciones sync y validate-slot no responden`,
        `docker start ${EDGE_CONTAINER}`
      );
    }
  }
}

// ------------------------------------------------------------ Endpoint sync
if (dockerUp) {
  try {
    const res = await fetch(`${API}/functions/v1/sync`, { method: 'POST' });
    if (res.status === 401) ok('sync', 'sirviendo y exigiendo token (401)');
    else if (res.status >= 500)
      fail('sync', `devuelve ${res.status}: el edge runtime no esta sirviendo`, `docker start ${EDGE_CONTAINER}`);
    else warn('sync', `respuesta inesperada ${res.status}`, null);
  } catch (e) {
    fail('sync', `no alcanzable (${e.message})`, 'cd backend/supabase ; npx supabase start');
  }
}

// ----------------------------------------------------------- Migraciones
if (dbUp) {
  try {
    const applied = new Set(
      psql('SELECT version FROM supabase_migrations.schema_migrations;')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    );
    const dir = join(ROOT, 'backend', 'supabase', 'migrations');
    const inRepo = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => f.split('_')[0]);
    const missing = inRepo.filter((v) => !applied.has(v));

    if (missing.length === 0) {
      ok('migraciones', `${inRepo.length} del repo, todas aplicadas`);
    } else {
      // `supabase start` NO aplica migraciones sobre un volumen existente.
      fail(
        'migraciones',
        `sin aplicar: ${missing.join(', ')}`,
        'cd backend/supabase ; npx supabase migration up --local'
      );
    }
  } catch (e) {
    warn('migraciones', `no se pudieron leer (${e.message})`, null);
  }
}

// -------------------------------- SCHEMA_VERSION local vs gate de sync_pull
if (dbUp) {
  try {
    const schemaSrc = readFileSync(join(ROOT, 'packages', 'models', 'src', 'schema.ts'), 'utf8');
    const localVersion = Number(schemaSrc.match(/SCHEMA_VERSION\s*=\s*(\d+)/)?.[1]);
    const def = psql(
      "SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sync_pull';"
    );
    const accepted = def
      .match(/p_schema_version NOT IN \(([^)]*)\)/)?.[1]
      ?.split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => !Number.isNaN(n));

    if (!localVersion || !accepted) {
      warn('schema version', 'no se pudo comparar el gate de sync_pull', null);
    } else if (accepted.includes(localVersion)) {
      ok('schema version', `local v${localVersion}, aceptada por sync_pull (${accepted.join(', ')})`);
    } else {
      fail(
        'schema version',
        `local v${localVersion} NO esta en el gate de sync_pull (${accepted.join(', ')}): ` +
          'todo pull sera rechazado y nada subira al servidor',
        'agregar una migracion que amplie la lista de p_schema_version en sync_pull'
      );
    }
  } catch (e) {
    warn('schema version', `no se pudo comprobar (${e.message})`, null);
  }
}

// ----------------------------------------------------------------- Reloj
if (dbUp) {
  try {
    const res = await fetch('https://www.cloudflare.com', { method: 'HEAD' });
    const real = new Date(res.headers.get('date')).getTime();
    const host = Date.now();
    const hostSkew = Math.round((host - real) / 1000);

    const vmText = psql("SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS');");
    const vm = new Date(`${vmText.replace(' ', 'T')}Z`).getTime();
    const vmSkew = Math.round((vm - real) / 1000);

    if (Math.abs(hostSkew) <= 30 && Math.abs(vmSkew) <= 30) {
      ok('reloj', `host y VM sincronizados (desvio ${hostSkew}s / ${vmSkew}s)`);
    } else {
      fail(
        'reloj',
        `desfase host ${hostSkew}s, VM ${vmSkew}s: la sesion fallara con "JWT issued at future"`,
        'como admin: Set-Service w32time -StartupType Automatic ; Start-Service w32time ; w32tm /resync /force'
      );
    }
  } catch (e) {
    warn('reloj', `no se pudo comparar con una fuente externa (${e.message})`, null);
  }
}

// ------------------------------------------------- Puerto de Metro usable
async function portBindable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve({ ok: false, code: err.code }));
    server.once('listening', () => server.close(() => resolve({ ok: true })));
    server.listen(port, '0.0.0.0');
  });
}

try {
  const probe = await fetch(`http://localhost:${METRO_PORT}/login`).catch(() => null);
  if (probe?.ok) {
    ok('metro', `respondiendo en ${METRO_PORT}`);
  } else {
    const bind = await portBindable(METRO_PORT);
    if (bind.ok) {
      warn(
        'metro',
        `no esta corriendo, pero el puerto ${METRO_PORT} esta usable`,
        `cd apps/mobile ; npx expo start --web --port ${METRO_PORT}`
      );
    } else if (bind.code === 'EACCES') {
      // Hyper-V reserva rangos TCP cuando Docker corre (acá 8013-8512).
      fail(
        'metro',
        `el puerto ${METRO_PORT} esta RESERVADO por Hyper-V/WSL (EACCES), no ocupado por un proceso`,
        'usar otro puerto fuera de los rangos de: netsh interface ipv4 show excludedportrange protocol=tcp'
      );
    } else {
      warn('metro', `el puerto ${METRO_PORT} no se pudo abrir (${bind.code})`, null);
    }
  }
} catch (e) {
  warn('metro', `no se pudo comprobar (${e.message})`, null);
}

// --------------------------------------------- A que Supabase apunta la app
try {
  const envPath = join(ROOT, 'apps', 'mobile', '.env.local');
  if (!existsSync(envPath)) {
    warn('env', '.env.local no existe', 'cd apps/mobile ; npm run env:local');
  } else {
    const text = readFileSync(envPath, 'utf8');
    const url = text.match(/^EXPO_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1]?.trim();
    const keyLen = (text.match(/^EXPO_PUBLIC_SUPABASE_ANON_KEY=(.*)$/m)?.[1] ?? '').trim().length;

    if (!url) warn('env', 'falta EXPO_PUBLIC_SUPABASE_URL', 'cd apps/mobile ; npm run env:local');
    else if (keyLen === 0)
      fail('env', 'EXPO_PUBLIC_SUPABASE_ANON_KEY esta vacia', 'cd apps/mobile ; npm run env:local');
    else {
      const target = url.includes('127.0.0.1') || url.includes('localhost') ? 'LOCAL' : 'HOSPEDADO';
      ok('env', `apunta a ${target} (${url}), clave presente`);
    }
  }
} catch (e) {
  warn('env', `no se pudo leer (${e.message})`, null);
}

// ---------------------------------------------------------------- Reporte
const ICON = { ok: 'OK  ', warn: 'AVISO', fail: 'FALLO' };
console.log('\nDiagnostico del entorno local de turnos-salon\n');
for (const r of results) {
  console.log(`${ICON[r.level].padEnd(6)} ${r.area.padEnd(16)} ${r.detail}`);
  if (r.fix) console.log(`${''.padEnd(23)} -> ${r.fix}`);
}

const fails = results.filter((r) => r.level === 'fail');
const warns = results.filter((r) => r.level === 'warn');
console.log(
  `\n${results.filter((r) => r.level === 'ok').length} bien, ${warns.length} aviso(s), ${fails.length} fallo(s).`
);

if (fails.length > 0) {
  console.log('\nArregla los FALLO en orden: suelen encadenarse.');
  process.exit(1);
}
