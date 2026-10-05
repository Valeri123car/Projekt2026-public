import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import multipart from '@fastify/multipart';
import { buildApp, adminToken, vodstvoToken, voznikToken } from './helpers/buildApp.js';
import dddUploadRoute from '../src/routes/ddd_upload.js';

function multipartZahteva(imeDatoteke, vsebina) {
  const meja = '----testnameja';
  return {
    headers: { 'content-type': `multipart/form-data; boundary=${meja}` },
    payload:
      `--${meja}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${imeDatoteke}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n' +
      `${vsebina}\r\n--${meja}--\r\n`,
  };
}

describe('POST /ddd_upload/upload – uvoz tahografa', () => {
  let app;

  beforeEach(async () => {
    app = buildApp({ uporabnik: { findFirst: vi.fn() }, tahografZapis: { create: vi.fn() }, $transaction: vi.fn() });
    app.register(multipart);
    app.register(dddUploadRoute, { prefix: '/ddd_upload' });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('voznik ne more uvažati tahografskih zapisov', async () => {
    const { headers, payload } = multipartZahteva('zapis.txt', 'vsebina');

    const res = await app.inject({
      method: 'POST',
      url: '/ddd_upload/upload',
      headers: { ...headers, authorization: `Bearer ${voznikToken(app)}` },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });

  it('admin pride do preverjanja datoteke', async () => {
    const { headers, payload } = multipartZahteva('zapis.txt', 'vsebina');

    const res = await app.inject({
      method: 'POST',
      url: '/ddd_upload/upload',
      headers: { ...headers, authorization: `Bearer ${adminToken(app)}` },
      payload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Datoteka mora biti .DDD ali .xlsx formata');
  });

  it('vodstvo pride do preverjanja datoteke', async () => {
    const { headers, payload } = multipartZahteva('zapis.txt', 'vsebina');

    const res = await app.inject({
      method: 'POST',
      url: '/ddd_upload/upload',
      headers: { ...headers, authorization: `Bearer ${vodstvoToken(app)}` },
      payload,
    });

    expect(res.statusCode).toBe(400);
  });
});
