import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp, adminToken, vodstvoToken, voznikToken } from './helpers/buildApp.js';
import strankeRoute from '../src/routes/stranke.js';

const mockStranka = {
  id_stranka: 1,
  naziv: 'Testna stranka',
  email: null,
  telefonska: null,
  davcna_st: null,
};

describe('Stranke – branje za vse, urejanje samo administrator', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({ stranka: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() } });
    app.register(strankeRoute, { prefix: '/stranke' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('voznik vidi seznam strank', async () => {
    app.prisma.stranka.findMany.mockResolvedValue([mockStranka]);

    const res = await app.inject({
      method: 'GET',
      url: '/stranke',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([mockStranka]);
  });

  it('voznik ne more ustvariti stranke', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/stranke',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
      payload: { naziv: 'Lažna stranka' },
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.stranka.create).not.toHaveBeenCalled();
  });

  it('vodstvo ne more ustvariti stranke', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/stranke',
      headers: { authorization: `Bearer ${vodstvoToken(app)}` },
      payload: { naziv: 'Lažna stranka' },
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.stranka.create).not.toHaveBeenCalled();
  });

  it('voznik ne more posodobiti stranke', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/stranke/1',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
      payload: { naziv: 'Spremenjeno' },
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.stranka.update).not.toHaveBeenCalled();
  });

  it('voznik ne more izbrisati stranke', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/stranke/1',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.stranka.delete).not.toHaveBeenCalled();
  });

  it('admin ustvari stranko', async () => {
    app.prisma.stranka.create.mockResolvedValue(mockStranka);

    const res = await app.inject({
      method: 'POST',
      url: '/stranke',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: { naziv: 'Testna stranka' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().naziv).toBe('Testna stranka');
  });
});
