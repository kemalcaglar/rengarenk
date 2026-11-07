import { createHash, createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import type { Env } from '../config/env.js';

export interface CatalogKeys {
  privatePem: string;
  publicPem: string;
}

export const CATALOG_KEYS = Symbol('CATALOG_KEYS');

/** Ed25519 PKCS#8 DER öneki; ardından 32 baytlık tohum gelir. */
const ED25519_PKCS8_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex');

function toKey(value: string, kind: 'private' | 'public'): KeyObject {
  const v = value.replace(/\\n/g, '\n').trim();
  if (v.startsWith('-----BEGIN')) return kind === 'private' ? createPrivateKey(v) : createPublicKey(v);
  const der = Buffer.from(v, 'base64');
  return kind === 'private'
    ? createPrivateKey({ key: der, format: 'der', type: 'pkcs8' })
    : createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Katalog paketi imza anahtarları. Canlıda ortamdan gelir (env.ts zorunlu kılar). Geliştirme ve testte verilmezse
 * JWT_SECRET'ten sabit bir çift türetilir: hat ve API aynı süreçte çalıştığı için yeterlidir.
 */
export function loadCatalogKeys(env: Env): CatalogKeys {
  if (env.CATALOG_SIGNING_KEY && env.CATALOG_VERIFY_KEY) {
    return {
      privatePem: toKey(env.CATALOG_SIGNING_KEY, 'private').export({
        type: 'pkcs8',
        format: 'pem',
      }) as string,
      publicPem: toKey(env.CATALOG_VERIFY_KEY, 'public').export({ type: 'spki', format: 'pem' }) as string,
    };
  }
  const seed = createHash('sha256').update(`rengarenk:katalog:${env.JWT_SECRET}`).digest();
  const priv = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: 'der',
    type: 'pkcs8',
  });
  return {
    privatePem: priv.export({ type: 'pkcs8', format: 'pem' }) as string,
    publicPem: createPublicKey(priv).export({ type: 'spki', format: 'pem' }) as string,
  };
}
