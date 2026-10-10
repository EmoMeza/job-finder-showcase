import { chromium, type Browser } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InvalidMagicLinkError } from '../connection.js';
import { createDemoConnection, parseDemoMagicLink } from './connection.js';
import { startDemoPortal } from './portal.js';

describe('parseDemoMagicLink', () => {
  const ORIGIN = 'https://portal.example';
  const VALID = `${ORIGIN}/ingresar/enlace?token=abc`;

  it('acepta un enlace de ingreso del portal', () => {
    expect(parseDemoMagicLink(`  ${VALID}  `, ORIGIN).hostname).toBe('portal.example');
  });

  it.each([
    ['otro dominio', 'https://example.com/ingresar/enlace?token=abc'],
    ['dominio que termina igual', 'https://evilportal.example/ingresar/enlace?token=abc'],
    [
      'el portal como subdominio de otro',
      'https://portal.example.evil.com/ingresar/enlace?token=abc',
    ],
    ['usuario en la URL', 'https://portal.example@evil.com/ingresar/enlace?token=abc'],
    ['credenciales en la URL', 'https://alguien@portal.example/ingresar/enlace?token=abc'],
    ['sin https', 'http://portal.example/ingresar/enlace?token=abc'],
    ['otro puerto', 'https://portal.example:8443/ingresar/enlace?token=abc'],
    ['otra ruta del sitio', 'https://portal.example/ofertas/algo?token=abc'],
    ['sin token', 'https://portal.example/ingresar/enlace'],
    ['texto que no es un enlace', 'hola'],
    ['javascript', 'javascript:alert(1)'],
  ])('rechaza %s', (_caso, link) => {
    expect(() => parseDemoMagicLink(link, ORIGIN)).toThrow(InvalidMagicLinkError);
  });
});

describe('conexión por enlace mágico (navegador real contra el portal de demostración)', () => {
  let browser: Browser;
  let portal: Awaited<ReturnType<typeof startDemoPortal>>;
  const link = (token: string) => `${portal.origin}/ingresar/enlace?token=${token}`;

  beforeAll(async () => {
    [browser, portal] = await Promise.all([
      chromium.launch(),
      startDemoPortal({ tokens: ['token-valido'] }),
    ]);
  });

  afterAll(async () => {
    await Promise.all([browser.close(), portal.close()]);
  });

  it('abre el enlace, confirma con "Ingresar" y deja la sesión iniciada', async () => {
    const connection = createDemoConnection(portal.origin);
    const context = await browser.newContext();

    await connection.openMagicLink(context, link('token-valido'));

    expect(await connection.isLoggedIn(context)).toBe(true);
    const { cookies } = await context.storageState();
    expect(cookies.map((cookie) => cookie.name)).toContain('demo_session');
    await context.close();
  });

  it('un enlace vencido no deja sesión', async () => {
    const connection = createDemoConnection(portal.origin);
    const context = await browser.newContext();

    await connection.openMagicLink(context, link('token-vencido'));

    expect(await connection.isLoggedIn(context)).toBe(false);
    await context.close();
  });

  it('la sesión guardada sirve en otro navegador', async () => {
    const connection = createDemoConnection(portal.origin);
    const first = await browser.newContext();
    await connection.openMagicLink(first, link('token-valido'));
    const storageState = await first.storageState();
    await first.close();

    const second = await browser.newContext({ storageState });

    expect(await connection.isLoggedIn(second)).toBe(true);
    await second.close();
  });

  it('el enlace que pide una persona en el portal sirve una sola vez', async () => {
    const connection = createDemoConnection(portal.origin);
    const visitor = await browser.newPage();
    await visitor.goto(`${portal.origin}/ingresar`);
    await visitor.getByRole('button', { name: 'Pedir enlace de ingreso' }).click();
    const requested = (await visitor.locator('#enlace').textContent()) ?? '';
    await visitor.close();

    const first = await browser.newContext();
    await connection.openMagicLink(first, requested);
    const second = await browser.newContext();
    await connection.openMagicLink(second, requested);

    expect(await connection.isLoggedIn(first)).toBe(true);
    expect(await connection.isLoggedIn(second)).toBe(false);
    await Promise.all([first.close(), second.close()]);
  });

  it('rechaza enlaces que no son del portal sin abrir nada', async () => {
    const connection = createDemoConnection(portal.origin);
    const context = await browser.newContext();

    await expect(
      connection.openMagicLink(context, 'https://example.com/ingresar/enlace?token=x'),
    ).rejects.toThrow(InvalidMagicLinkError);
    expect(context.pages()).toHaveLength(0);
    await context.close();
  });
});
