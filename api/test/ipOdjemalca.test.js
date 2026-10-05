import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { ipOdjemalca } from '../src/lib/ipOdjemalca.js';

describe('Omejitev zahtev po IP-ju odjemalca za Fly proxyjem', () => {
  let app;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(rateLimit, { max: 1, timeWindow: '1 minute', keyGenerator: ipOdjemalca });
    app.get('/', async () => ({ ok: true }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('dva odjemalca za istim proxyjem si ne delita omejitve', async () => {
    const prvi = await app.inject({ method: 'GET', url: '/', headers: { 'fly-client-ip': '203.0.113.10' } });
    const drugi = await app.inject({ method: 'GET', url: '/', headers: { 'fly-client-ip': '203.0.113.20' } });

    expect(prvi.statusCode).toBe(200);
    expect(drugi.statusCode).toBe(200);
  });

  it('isti odjemalec je omejen', async () => {
    await app.inject({ method: 'GET', url: '/', headers: { 'fly-client-ip': '203.0.113.10' } });
    const ponovno = await app.inject({ method: 'GET', url: '/', headers: { 'fly-client-ip': '203.0.113.10' } });

    expect(ponovno.statusCode).toBe(429);
  });

  it('brez Fly glave uporabi naslov povezave', async () => {
    await app.inject({ method: 'GET', url: '/' });
    const ponovno = await app.inject({ method: 'GET', url: '/' });

    expect(ponovno.statusCode).toBe(429);
  });
});
