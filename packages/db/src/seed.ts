import { createPrismaClient, uuidv7 } from './index.js';

// Yerel geliştirme için başlangıç verisi. Canlıda çalıştırılmaz.
if (process.env.NODE_ENV === 'production') throw new Error('seed canlıda çalıştırılamaz');

const prisma = createPrismaClient();

// Sprint 3 öncesi seed'in yerel sahibi şirket alanına taşınır (yönetim girişi yalnızca şirket e-postası kabul eder).
await prisma.staffMember.updateMany({
  where: { email: 'sahip@rengarenk.local' },
  data: { email: 'sahip@rengarenksite.com' },
});

// Yerel sahip: konsola bu e-postayla girilir; ilk girişte doğrulama uygulaması kurulur. Kendi adresinle
// denemek için `.env` içinde SEED_OWNER_EMAIL ver (alanı STAFF_EMAIL_DOMAINS içinde olmalı).
const ownerEmail = (process.env.SEED_OWNER_EMAIL || 'sahip@rengarenksite.com').trim().toLowerCase();
const owner = await prisma.staffMember.upsert({
  where: { email: ownerEmail },
  update: {},
  create: {
    id: uuidv7(),
    email: ownerEmail,
    name: process.env.SEED_OWNER_NAME || 'Sahip (yerel)',
    role: 'OWNER',
  },
});

const user = await prisma.user.upsert({
  where: { phone: '+905550000001' },
  update: {},
  create: { id: uuidv7(), phone: '+905550000001', phoneVerifiedAt: new Date(), displayName: 'Ayşe Y.' },
});

const existing = await prisma.accountMember.findFirst({ where: { userId: user.id } });
if (!existing) {
  const account = await prisma.account.create({
    data: {
      id: uuidv7(),
      kind: 'INDIVIDUAL',
      name: 'Ayşe Y.',
      members: { create: { userId: user.id, role: 'OWNER' } },
    },
  });
  await prisma.entitlementLedger.create({
    data: {
      accountId: account.id,
      kind: 'talep',
      delta: 1,
      reason: 'tanimlama',
      sourceType: 'seed',
      sourceId: account.id,
      createdBy: owner.id,
    },
  });
}

console.log(`seed tamam: yönetim ${ownerEmail}, kullanıcı +905550000001`);
await prisma.$disconnect();
