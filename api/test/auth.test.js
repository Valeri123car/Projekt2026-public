import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp } from './helpers/buildApp.js';
import authRoute from '../src/routes/auth.js';
import bcrypt from 'bcryptjs';

const hashedGeslo = bcrypt.hashSync('geslo123', 10);

const mockUporabnik = {
  id_uporabnik: 1,
  ime: 'Ana',
  priimek: 'Novak',
  email: 'ana@test.si',
  geslo: hashedGeslo,
  dostop: 2,
};

describe('POST /auth/login', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({
      uporabnik: {
        findUnique: vi.fn(),
      },
    });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('vrne 401 za neobstoječ email', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'neobstaja@test.si', geslo: 'geslo123' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Napačen email ali geslo');
  });

  it('vrne 401 za napačno geslo', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue(mockUporabnik);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@test.si', geslo: 'napacno_geslo' },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('Napačen email ali geslo');
  });

  it('vrne žeton in vlogo ob uspešni prijavi', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue(mockUporabnik);

    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@test.si', geslo: 'geslo123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.token).toBeDefined();
    expect(body.vloga).toBe(2);
  });

  it('vrne 400 za manjkajoča polja', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'ana@test.si' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('GET /auth/me', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({
      uporabnik: { findUnique: vi.fn() },
    });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('vrne 401 brez žetona', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('vrne podatke prijavljenega uporabnika', async () => {
    const token = app.jwt.sign({ id: 1, email: 'ana@test.si', vloga: 2 });
    app.prisma.uporabnik.findUnique.mockResolvedValue({
      id_uporabnik: 1,
      ime: 'Ana',
      priimek: 'Novak',
      email: 'ana@test.si',
      dostop: 2,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('ana@test.si');
  });
});

describe('PUT /auth/me', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({
      uporabnik: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('posodobi ime in priimek', async () => {
    const token = app.jwt.sign({ id: 1, email: 'ana@test.si', vloga: 2 });
    app.prisma.uporabnik.update.mockResolvedValue({
      id_uporabnik: 1, ime: 'Maja', priimek: 'Novak', email: 'ana@test.si', dostop: 2,
    });

    const res = await app.inject({
      method: 'PUT',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: { ime: 'Maja', priimek: 'Novak' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ime).toBe('Maja');
  });

  it('vrne 400 za prazno telo', async () => {
    const token = app.jwt.sign({ id: 1, email: 'ana@test.si', vloga: 2 });

    const res = await app.inject({
      method: 'PUT',
      url: '/auth/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /auth/register', () => {
  let app;
  const novUporabnik = {
    ime: 'Janez',
    priimek: 'Novak',
    email: 'janez@test.si',
    geslo: 'geslo123',
    dostop: 2,
    gdpr_soglasje: true,
  };

  beforeEach(async () => {
    app = buildApp({
      uporabnik: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('vrne 401 brez žetona', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: novUporabnik,
    });

    expect(res.statusCode).toBe(401);
    expect(app.prisma.uporabnik.create).not.toHaveBeenCalled();
  });

  it('vrne 403 za voznika', async () => {
    const token = app.jwt.sign({ id: 3, email: 'voznik@test.si', vloga: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: novUporabnik,
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.uporabnik.create).not.toHaveBeenCalled();
  });

  it('vrne 403 za vodstvo', async () => {
    const token = app.jwt.sign({ id: 2, email: 'vodstvo@test.si', vloga: 3 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: novUporabnik,
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.uporabnik.create).not.toHaveBeenCalled();
  });

  it('admin ustvari uporabnika', async () => {
    const token = app.jwt.sign({ id: 1, email: 'ana@test.si', vloga: 2 });
    app.prisma.uporabnik.findUnique.mockResolvedValue(null);
    app.prisma.uporabnik.create.mockResolvedValue({
      id_uporabnik: 7,
      email: 'janez@test.si',
    });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { authorization: `Bearer ${token}` },
      payload: novUporabnik,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: 7, email: 'janez@test.si' });
  });
});

describe('POST /auth/refresh', () => {
  let app;
  const sekunde = () => Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

  beforeEach(async () => {
    app = buildApp({
      uporabnik: { findUnique: vi.fn() },
    });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
    app.prisma.uporabnik.findUnique.mockResolvedValue(mockUporabnik);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('zavrne žeton s ponarejenim podpisom', async () => {
    const ponarejen = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: 1, email: 'ana@test.si', vloga: 2 })}.ponarejenpodpis`;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${ponarejen}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().token).toBeUndefined();
    expect(app.prisma.uporabnik.findUnique).not.toHaveBeenCalled();
  });

  it('zavrne voznikov žeton, v katerem je id zamenjan z adminovim', async () => {
    const [glava, , podpis] = app.jwt.sign({ id: 3, email: 'voznik@test.si', vloga: 1 }).split('.');
    const spremenjen = `${glava}.${b64({ id: 1, email: 'voznik@test.si', vloga: 1, iat: sekunde() })}.${podpis}`;

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${spremenjen}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().token).toBeUndefined();
  });

  it('obnovi veljavno podpisan žeton, ki je potekel', async () => {
    const potekel = app.jwt.sign(
      { id: 1, email: 'ana@test.si', vloga: 2, iat: sekunde() - 24 * 60 * 60 },
      { expiresIn: '8h' },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${potekel}` },
    });

    expect(res.statusCode).toBe(200);
    const novi = app.jwt.verify(res.json().token);
    expect(novi.id).toBe(1);
    expect(novi.vloga).toBe(2);
    expect(novi.exp).toBeGreaterThan(sekunde());
  });

  it('zavrne žeton, izdan pred več kot 30 dnevi', async () => {
    const star = app.jwt.sign(
      { id: 1, email: 'ana@test.si', vloga: 2, iat: sekunde() - 31 * 24 * 60 * 60 },
      { expiresIn: '8h' },
    );

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${star}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().token).toBeUndefined();
  });

  it('ne obnovi žetona anonimiziranega računa', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue({
      id_uporabnik: 1,
      ime: 'IZBRISANO',
      priimek: 'IZBRISANO',
      email: 'deleted_1_1700000000000@izbrisano.si',
      geslo: 'IZBRISANO',
      dostop: 2,
    });
    const token = app.jwt.sign({ id: 1, email: 'ana@test.si', vloga: 2 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().token).toBeUndefined();
  });
});

describe('POST /auth/google-token', () => {
  let app;
  const prejsnjiClientId = process.env.GOOGLE_CLIENT_ID;

  beforeEach(async () => {
    app = buildApp({ uporabnik: { findUnique: vi.fn() } });
    app.register(authRoute, { prefix: '/auth' });
    await app.ready();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ access_token: 'google_zeton' }) }));
  });

  afterEach(async () => {
    await app.close();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    if (prejsnjiClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = prejsnjiClientId;
  });

  it('Googlu pošlje client_id iz okoljske spremenljivke', async () => {
    process.env.GOOGLE_CLIENT_ID = 'testni-id.apps.googleusercontent.com';
    const token = app.jwt.sign({ id: 3, email: 'voznik@test.si', vloga: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/google-token',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: 'koda123', redirectUri: 'app:/redirect' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().access_token).toBe('google_zeton');
    const [, zahteva] = fetch.mock.calls[0];
    expect(zahteva.body.get('client_id')).toBe('testni-id.apps.googleusercontent.com');
    expect(zahteva.body.get('code')).toBe('koda123');
  });

  it('vrne 503, če GOOGLE_CLIENT_ID ni nastavljen', async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const token = app.jwt.sign({ id: 3, email: 'voznik@test.si', vloga: 1 });

    const res = await app.inject({
      method: 'POST',
      url: '/auth/google-token',
      headers: { authorization: `Bearer ${token}` },
      payload: { code: 'koda123', redirectUri: 'app:/redirect' },
    });

    expect(res.statusCode).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
