import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cspIhlalleri } from '../src/security/csp-report.js';
import { createTestApp } from './helpers.js';

let app: NestFastifyApplication;

beforeAll(async () => {
  ({ app } = await createTestApp());
});
afterAll(() => app.close());

describe('CSP ihlal bildirimi (web, rapor modu)', () => {
  it('eski report-uri biçimi: yönerge, engellenen kaynağın yalnızca kökü, sayfanın yalnızca yolu', () => {
    expect(
      cspIhlalleri({
        'csp-report': {
          'document-uri': 'https://beta.rengarenksite.com/talepler?q=05551234567',
          'effective-directive': 'script-src-elem',
          'blocked-uri': 'https://kotu.example.com/a.js?x=1',
        },
      }),
    ).toEqual([{ yonerge: 'script-src-elem', engellenen: 'https://kotu.example.com', sayfa: '/talepler' }]);
  });

  it('Reporting API biçimi (dizi); başka türdeki bildirimler atlanır', () => {
    expect(
      cspIhlalleri([
        {
          type: 'csp-violation',
          body: {
            documentURL: 'https://beta.rengarenksite.com/',
            effectiveDirective: 'style-src-attr',
            blockedURL: 'inline',
          },
        },
        { type: 'deprecation', body: { id: 'x' } },
      ]),
    ).toEqual([{ yonerge: 'style-src-attr', engellenen: 'inline', sayfa: '/' }]);
    expect(cspIhlalleri('bozuk')).toEqual([]);
  });

  it('uç iki içerik türünü de kabul eder, bozuk gövdede de 204 döner', async () => {
    for (const [tur, govde] of [
      ['application/csp-report', JSON.stringify({ 'csp-report': { 'effective-directive': 'img-src' } })],
      [
        'application/reports+json',
        JSON.stringify([{ type: 'csp-violation', body: { effectiveDirective: 'img-src' } }]),
      ],
      ['application/csp-report', '{bozuk'],
    ] as const) {
      const r = await app.inject({
        method: 'POST',
        url: '/guvenlik/csp-rapor',
        headers: { 'content-type': tur },
        payload: govde,
      });
      expect(r.statusCode).toBe(204);
    }
  });
});
