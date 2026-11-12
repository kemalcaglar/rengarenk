import { createPrismaClient, uuidv7 } from '@rengarenk/db';
import { loadEnv } from '../config/env.js';

/**
 * İlk Sahip hesabını açar (canlıda kurulumda bir kez). Sahip zaten varsa hiçbir şey yapmaz.
 * Diğer çalışanlar konsoldan davetle eklenir. İlk girişte doğrulama uygulaması kurulur.
 *
 *   node dist/cli/sahip.js kemal@rengarenksite.com "Kemal Çağlar"
 *   (yerelde) pnpm --filter @rengarenk/api sahip kemal@rengarenksite.com "Kemal Çağlar"
 */
const [emailArg, ...nameParts] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const name = nameParts.join(' ').trim();
if (!email || !name) {
  console.error('Kullanım: sahip <şirket e-postası> <ad soyad>');
  process.exit(1);
}

const env = loadEnv();
const domain = email.split('@')[1] ?? '';
if (!env.STAFF_EMAIL_DOMAINS.includes(domain)) {
  console.error(`E-posta şu alanlardan biri olmalı: ${env.STAFF_EMAIL_DOMAINS.join(', ')}`);
  process.exit(1);
}

const db = createPrismaClient(env.DATABASE_URL);
try {
  const existing = await db.staffMember.findFirst({ where: { role: 'OWNER' } });
  if (existing) {
    console.log('Sahip hesabı zaten var; değişiklik yapılmadı.');
  } else {
    await db.$transaction(async (tx) => {
      const owner = await tx.staffMember.create({
        data: { id: uuidv7(), email, name, role: 'OWNER', status: 'ACTIVE' },
      });
      await tx.auditLog.create({
        data: {
          actorType: 'SYSTEM',
          action: 'sahip_hesabi_acildi',
          entityType: 'staff_member',
          entityId: owner.id,
        },
      });
    });
    console.log(
      'Sahip hesabı açıldı. Yönetim konsoluna Google hesabınla gir; ilk girişte doğrulama uygulaması kurulur.',
    );
  }
} finally {
  await db.$disconnect();
}
