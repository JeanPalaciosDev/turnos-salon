// @ts-nocheck
/**
 * Revisión visual de la app a viewport MÓVIL (390x844) con el Chrome del
 * sistema. Es una app móvil: revisarla a ancho de escritorio es engañoso.
 *
 *   npm run review:mobile                      # rutas por defecto, paleta actual
 *   npm run review:mobile -- --rutas=/agenda,/owner
 *   npm run review:mobile -- --paletas=Carmelita,Verde --modo=Oscuro
 *   npm run review:mobile -- --puerto=19006 --sin-login
 *
 * Requiere Metro corriendo (`npx expo start --web --port 19006`) y, para las
 * pantallas internas, una sesión. La contraseña se toma de TURNOS_REVIEW_PASS o
 * del archivo que indique TURNOS_REVIEW_PASS_FILE; nunca se imprime.
 * Para fijar una contraseña conocida en la base LOCAL de desarrollo:
 *   UPDATE auth.users SET encrypted_password = crypt('<pass>', gen_salt('bf'))
 *   WHERE email = 'owner.local@salon.test';
 *
 * Gotchas de RN Web ya resueltos acá: `input:visible` (Expo Router deja la
 * pantalla anterior montada y oculta), `type()` agrega al valor existente, y
 * accessibilityLabel sale como aria-label, no como role=button.
 */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : fallback;
}
const flag = (name) => process.argv.includes(`--${name}`);

const PORT = arg('puerto', '19006');
const BASE = `http://localhost:${PORT}`;
const ROUTES = arg('rutas', '/agenda,/owner,/services,/workers').split(',').filter(Boolean);
const PALETTES = arg('paletas', '').split(',').filter(Boolean);
const MODE = arg('modo', '');
const EMAIL = arg('email', 'owner.local@salon.test');
const OUT = join(tmpdir(), 'turnos-review-mobile');

function readPassword() {
  if (process.env.TURNOS_REVIEW_PASS) return process.env.TURNOS_REVIEW_PASS;
  const file = process.env.TURNOS_REVIEW_PASS_FILE ?? join(tmpdir(), 'turnos-review-pass.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  return null;
}

/** En RN Web, fill() no actualiza el state del TextInput y type() ACUMULA. */
async function typeInto(page, locator, value) {
  await locator.click();
  await locator.fill('');
  await locator.type(value, { delay: 20 });
}

async function applyTheme(page, { mode, color }) {
  // El 🖌 del header expone accessibilityLabel="Tema" -> aria-label.
  const brush = page.locator('[aria-label="Tema"]').first();
  if ((await brush.count()) === 0) {
    console.log('  (sin boton de tema en esta pantalla)');
    return false;
  }
  await brush.click();
  await page.waitForTimeout(800);

  for (const label of [mode, color].filter(Boolean)) {
    const opt = page.locator(`text=${label}`).first();
    if ((await opt.count()) === 0) {
      console.log(`  (opcion "${label}" no encontrada)`);
      continue;
    }
    const box = await opt.boundingBox();
    if (box && (box.x < 0 || box.x + box.width > 390)) {
      console.log(`  AVISO: "${label}" cae fuera del viewport de 390px`);
    }
    await opt.click();
    await page.waitForTimeout(700);
  }
  if (await brush.isVisible().catch(() => false)) {
    await brush.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  return true;
}

async function capture(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path });
  console.log(`  captura ${name}.png`);
}

(async () => {
  mkdirSync(OUT, { recursive: true });

  if (!existsSync(CHROME)) {
    console.error(`FAIL: no se encontro Chrome en ${CHROME}`);
    console.error('NUNCA correr "npx playwright install": los CDN estan bloqueados aqui.');
    process.exit(1);
  }

  try {
    const probe = await fetch(`${BASE}/login`);
    if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
  } catch (e) {
    console.error(`FAIL: Metro no responde en ${BASE} (${e.message}).`);
    console.error(`Levantalo con: npx expo start --web --port ${PORT}`);
    console.error('Recorda que con Docker encendido el 8081 esta reservado por Hyper-V.');
    process.exit(1);
  }

  const context = await chromium.launchPersistentContext(join(OUT, 'profile'), {
    executablePath: CHROME,
    headless: false,
    slowMo: 70,
    viewport: { width: 390, height: 844 },
  });
  const page = context.pages()[0] ?? (await context.newPage());

  const problems = [];
  page.on('pageerror', (e) => problems.push(`[pageerror] ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[console] ${m.text().slice(0, 200)}`);
  });

  if (!flag('sin-login')) {
    const pass = readPassword();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 });
    await page.waitForTimeout(2500);

    if (page.url().includes('/login')) {
      if (!pass) {
        console.error('FAIL: falta la contrasena. Define TURNOS_REVIEW_PASS o usa --sin-login.');
        await context.close();
        process.exit(1);
      }
      const inputs = page.locator('input:visible');
      await typeInto(page, inputs.nth(0), EMAIL);
      await typeInto(page, inputs.nth(1), pass);
      await page.getByText('Ingresar', { exact: false }).last().click();
      await page.waitForTimeout(9000);
    }
    console.log(`login -> ${page.url()}`);
  }

  const variants = PALETTES.length > 0 ? PALETTES : [null];

  for (const color of variants) {
    if (color || MODE) {
      await page.goto(`${BASE}${ROUTES[0]}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await applyTheme(page, { mode: MODE, color });
    }
    const tag = [MODE, color].filter(Boolean).join('-').toLowerCase() || 'actual';

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);
      const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'raiz';
      await capture(page, `${tag}-${slug}`);
    }
  }

  if (problems.length > 0) {
    console.log('\nerrores de pagina detectados:');
    [...new Set(problems)].slice(0, 10).forEach((p) => console.log(`  ${p}`));
  }

  console.log(`\ncapturas en: ${OUT}`);
  await context.close();
})().catch((e) => {
  console.error(`FALLO: ${e.message}`);
  process.exit(1);
});
