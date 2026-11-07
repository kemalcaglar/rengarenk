import { generateKeyPairSync } from 'node:crypto';

/**
 * Katalog paketleri için yeni Ed25519 anahtar çifti üretir (canlı kurulumda bir kez).
 * Çıktıdaki iki satır .env.prod'a girer; gizli anahtar yalnızca katalog hattının çalıştığı yerde bulunur.
 *
 *   node dist/cli/katalog-anahtar.js
 */
const { privateKey, publicKey } = generateKeyPairSync('ed25519');
console.log(`CATALOG_SIGNING_KEY=${privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64')}`);
console.log(`CATALOG_VERIFY_KEY=${publicKey.export({ type: 'spki', format: 'der' }).toString('base64')}`);
