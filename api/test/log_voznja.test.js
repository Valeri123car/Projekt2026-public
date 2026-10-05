import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildApp, adminToken, vodstvoToken, voznikToken } from './helpers/buildApp.js';
import logRoute from '../src/routes/log_voznja.js';

const vnos = { type: 'DELETE /api/v1/voznje/5', voznja_id_voznja: 5, voznja_fk_uporabnik: 1 };

describe('POST /log – ročni vnos v revizijski dnevnik', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({ lOG_voznja: { findMany: vi.fn(), create: vi.fn() } });
    app.register(logRoute, { prefix: '/log' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('voznik ne more zapisati vnosa v imenu drugega uporabnika', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/log',
      headers: { authorization: `Bearer ${voznikToken(app)}` },
      payload: vnos,
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.lOG_voznja.create).not.toHaveBeenCalled();
  });

  it('vodstvo ne more zapisati vnosa', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/log',
      headers: { authorization: `Bearer ${vodstvoToken(app)}` },
      payload: vnos,
    });

    expect(res.statusCode).toBe(403);
    expect(app.prisma.lOG_voznja.create).not.toHaveBeenCalled();
  });

  it('admin zapiše vnos', async () => {
    app.prisma.lOG_voznja.create.mockResolvedValue({ idLOG: 9, TYPE: vnos.type });

    const res = await app.inject({
      method: 'POST',
      url: '/log',
      headers: { authorization: `Bearer ${adminToken(app)}` },
      payload: vnos,
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().idLOG).toBe(9);
  });
});
