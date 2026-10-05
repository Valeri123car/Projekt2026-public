import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp, adminToken, vodstvoToken, voznikToken } from './helpers/buildApp.js';
import adminRoute from '../src/routes/admin.js';

function buildAdminApp() {
  const app = buildApp({
    uporabnik: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    voznja: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    stranka: { findMany: vi.fn(), create: vi.fn() },
    vozilo: { findMany: vi.fn() },
    tahografZapis: { findMany: vi.fn() },
    lOG_voznja: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  });
  app.register(adminRoute, { prefix: '/admin' });
  return app;
}

describe('GET /admin/vozniki – managementOk middleware', () => {
  let app;

  beforeEach(async () => {
    app = buildAdminApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('admin (vloga 2) ima dostop', async () => {
    app.prisma.uporabnik.findMany.mockResolvedValue([]);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/vozniki',
      headers: { authorization: `Bearer ${adminToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('vodstvo (vloga 3) ima dostop', async () => {
    app.prisma.uporabnik.findMany.mockResolvedValue([]);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/vozniki',
      headers: { authorization: `Bearer ${vodstvoToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('voznik (vloga 1) nima dostopa', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/vozniki',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /admin/uporabniki – adminOnly middleware', () => {
  let app;

  beforeEach(async () => {
    app = buildAdminApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('admin (vloga 2) ima dostop', async () => {
    app.prisma.uporabnik.findMany.mockResolvedValue([]);
    const res = await app.inject({
      method: 'GET',
      url: '/admin/uporabniki',
      headers: { authorization: `Bearer ${adminToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('vodstvo (vloga 3) nima dostopa', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/uporabniki',
      headers: { authorization: `Bearer ${vodstvoToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('voznik (vloga 1) nima dostopa', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/admin/uporabniki',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /admin/voznje/:id/placano', () => {
  let app;

  beforeEach(async () => {
    app = buildAdminApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('preklopi placano status', async () => {
    app.prisma.voznja.findUnique.mockResolvedValue({ id_voznja: 1, placano: false });
    app.prisma.voznja.update.mockResolvedValue({ id_voznja: 1, placano: true });

    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/voznje/1/placano',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { placano: true },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().placano).toBe(true);
  });

  it('vrne 404 za neobstoječo vožnjo', async () => {
    app.prisma.voznja.findUnique.mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: '/admin/voznje/999/placano',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { placano: true },
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /admin/uporabniki/:id', () => {
  let app;

  beforeEach(async () => {
    app = buildAdminApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('admin ne more izbrisati lastnega računa', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue({ id_uporabnik: 1, email: 'admin@test.si', dostop: 2 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/uporabniki/1',
      headers: { authorization: `Bearer ${adminToken(app)}` },
    });

    expect(res.statusCode).toBe(400);
    expect(app.prisma.uporabnik.delete).not.toHaveBeenCalled();
  });

  it('admin izbriše drugega uporabnika', async () => {
    app.prisma.uporabnik.findUnique.mockResolvedValue({ id_uporabnik: 3, email: 'voznik@test.si', dostop: 1 });
    app.prisma.uporabnik.delete.mockResolvedValue({ id_uporabnik: 3 });

    const res = await app.inject({
      method: 'DELETE',
      url: '/admin/uporabniki/3',
      headers: { authorization: `Bearer ${adminToken(app)}` },
    });

    expect(res.statusCode).toBe(204);
    expect(app.prisma.uporabnik.delete).toHaveBeenCalledWith({ where: { id_uporabnik: 3 } });
  });
});
