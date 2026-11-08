import { z } from 'zod';

/**
 * Yönetim konsolu: çalışan rolleri, izin matrisi ve dört göz kuralları (Karar 40, Teknik tasarım §11).
 * Matris, onaylı tasarımdaki "Roller ve yetkiler" ekranıyla (docs/tasarim/YonetimEkip) birebirdir.
 * API izin denetimi ve konsol arayüzü aynı tanımı kullanır.
 */

/** Yetki düzeyleri: tam yetki, öneri hazırlar (onay gerekir), kişisel veri maskeli, başkasının işlemini onaylar. */
export const PERMISSION_LEVELS = ['tam', 'oneri', 'maskeli', 'onay'] as const;
export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PERMISSIONS = [
  { key: 'rapor.gor', ad: 'Raporları görme' },
  { key: 'kisisel_veri.gor', ad: 'Kişisel veriyi açık görme' },
  { key: 'sikayet.coz', ad: 'Şikâyetleri çözme, uyarma' },
  { key: 'hesap.askiya_al', ad: 'Askıya alma (24 saat)' },
  { key: 'hesap.kalici_engelle', ad: 'Kalıcı engelleme' },
  { key: 'galeri_basvuru.onayla', ad: 'Galeri başvurusu onaylama' },
  { key: 'destek.yanitla', ad: 'Destek taleplerini yanıtlama' },
  { key: 'hak.tanimla', ad: 'Hak tanımlama (küçük limit)' },
  { key: 'iade', ad: 'İade' },
  { key: 'kampanya.hazirla', ad: 'Kampanya ve kupon hazırlama' },
  { key: 'toplu_gonderim', ad: 'Toplu gönderim (1.000+ kişi)' },
  { key: 'fiyat.degistir', ad: 'Fiyat ve paket değişikliği' },
  { key: 'rapor.disa_aktar', ad: 'Rapor dışa aktarma (Excel, CSV)' },
  { key: 'kategori.ayarla', ad: 'Kategori, alan ve eşleştirme ayarı' },
  { key: 'gorunum.duzenle', ad: 'Görünüm, banner ve açılış sayfası' },
  { key: 'tasarim_yasal.duzenle', ad: 'Tasarım değerleri ve yasal metin' },
  { key: 'kvkk.yanitla', ad: 'KVKK başvurusu yanıtlama' },
  { key: 'yapay_zeka.butce', ad: 'Yapay zekâ bütçesi' },
  { key: 'sistem.ayarla', ad: 'Bakım modu ve özellik anahtarları' },
  { key: 'ekip.yonet', ad: 'Çalışan ve rol yönetimi' },
  { key: 'islem_kaydi.gor', ad: 'İşlem kaydını görme' },
] as const;

export type Permission = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];
export type PermissionGrants = Partial<Record<Permission, PermissionLevel>>;

/**
 * Hazır roller (değiştirilemez). Veritabanındaki `StaffRole` değerleri.
 * CATALOG eski bir değerdir; sahip kararıyla (7 Kasım 2026) hazır roller dışında, atanamaz.
 * Katalog sorumlusu gerektiğinde özel rol olarak oluşturulur. CUSTOM: özel rol atanmış çalışan.
 */
export const BUILTIN_ROLES = [
  { key: 'OWNER', ad: 'Sahip' },
  { key: 'ADMIN', ad: 'Yönetici' },
  { key: 'MODERATOR', ad: 'Moderatör' },
  { key: 'OPERATIONS', ad: 'Operasyon' },
  { key: 'SUPPORT', ad: 'Destek' },
  { key: 'MARKETING', ad: 'Pazarlama' },
  { key: 'FINANCE', ad: 'Finans' },
  { key: 'VIEWER', ad: 'İzleyici' },
  { key: 'AGENT', ad: 'Ajan' },
] as const;
export type BuiltinRole = (typeof BUILTIN_ROLES)[number]['key'];
export type StaffRoleKey = BuiltinRole | 'CUSTOM' | 'CATALOG';

/** Davetle verilebilen hazır roller. Sahip tektir; ajan bir servis hesabıdır, davetle açılmaz. */
export const INVITABLE_ROLES = [
  'ADMIN',
  'MODERATOR',
  'OPERATIONS',
  'SUPPORT',
  'MARKETING',
  'FINANCE',
  'VIEWER',
] as const;

const CELL: Record<string, PermissionLevel | null> = {
  '✓': 'tam',
  Ö: 'oneri',
  M: 'maskeli',
  O: 'onay',
  '–': null,
};

/** Tasarımdaki matris; sütun sırası BUILTIN_ROLES ile aynı. */
const MATRIX: Record<Permission, string> = {
  'rapor.gor': '✓✓MMM✓✓✓✓',
  'kisisel_veri.gor': '✓✓MMM––––',
  'sikayet.coz': '✓✓✓–––––✓',
  'hesap.askiya_al': '✓✓✓–––––✓',
  'hesap.kalici_engelle': '✓✓✓–––––Ö',
  'galeri_basvuru.onayla': '✓✓–✓––––✓',
  'destek.yanitla': '✓✓–✓✓–––✓',
  'hak.tanimla': '✓✓––✓––––',
  iade: '✓Ö––Ö–Ö–Ö',
  'kampanya.hazirla': '✓✓–––✓––Ö',
  toplu_gonderim: '✓O–––Ö–––',
  'fiyat.degistir': '✓Ö––––Ö–Ö',
  'rapor.disa_aktar': '✓✓––––✓––',
  'kategori.ayarla': '✓✓–––––––',
  'gorunum.duzenle': '✓✓–––✓––Ö',
  'tasarim_yasal.duzenle': '✓Ö–––Ö–––',
  'kvkk.yanitla': '✓✓––Ö–––Ö',
  'yapay_zeka.butce': '✓––––––––',
  'sistem.ayarla': '✓✓–––––––',
  'ekip.yonet': '✓––––––––',
  'islem_kaydi.gor': '✓✓–––––✓–',
};

export const ROLE_GRANTS: Record<BuiltinRole, PermissionGrants> = Object.fromEntries(
  BUILTIN_ROLES.map((role, col) => {
    const grants: PermissionGrants = {};
    for (const key of PERMISSION_KEYS) {
      const level = CELL[Array.from(MATRIX[key])[col] ?? '–'];
      if (level) grants[key] = level;
    }
    return [role.key, grants];
  }),
) as Record<BuiltinRole, PermissionGrants>;

/** Özel rollere verilemeyen yetkiler: çalışan yönetimi ve iadede tam yetki yalnızca sahibindir (Karar 40). */
export function ownerOnlyViolation(grants: PermissionGrants): boolean {
  return Boolean(grants['ekip.yonet']) || grants.iade === 'tam';
}

/** Düzey sırası: istenen düzeyi karşılayan düzeyler. */
export function satisfies(have: PermissionLevel | undefined, need: PermissionLevel): boolean {
  if (!have) return false;
  if (have === need) return true;
  // Tam yetki her düzeyi karşılar; maskeli görme yalnızca "maskeli" isteyeni karşılar.
  return have === 'tam';
}

// ── Dört göz onayı ─────────────────────────────────────────────

export const APPROVAL_KINDS = [
  'REFUND',
  'PRICE_CHANGE',
  'BULK_SEND',
  'COUPON',
  'PERMANENT_BAN',
  'ACCOUNT_DELETE',
  'CATEGORY_SCHEMA',
] as const;
export type ApprovalKindKey = (typeof APPROVAL_KINDS)[number];

export interface ApprovalPolicy {
  ad: string;
  /** İsteği açabilmek için gereken yetki (tam ya da öneri düzeyinde). */
  permission: Permission;
  /** Onaylayabilecek hazır roller. Özel roller ve ajan hiçbir zaman onaylayamaz. */
  approvers: BuiltinRole[];
  kural: string;
}

export const APPROVAL_POLICIES: Record<ApprovalKindKey, ApprovalPolicy> = {
  REFUND: {
    ad: 'İade',
    permission: 'iade',
    approvers: ['OWNER'],
    kural: 'İadeleri yalnızca sahip onaylar (Karar 40).',
  },
  PRICE_CHANGE: {
    ad: 'Fiyat ve paket',
    permission: 'fiyat.degistir',
    approvers: ['OWNER'],
    kural: 'Fiyat ve paket değişikliğini sahip onaylar.',
  },
  BULK_SEND: {
    ad: 'Toplu gönderim',
    permission: 'toplu_gonderim',
    approvers: ['OWNER', 'ADMIN'],
    kural: '1.000 kişiden büyük gönderim sahip veya yönetici onayı ister.',
  },
  COUPON: {
    ad: 'Kupon',
    permission: 'kampanya.hazirla',
    approvers: ['OWNER', 'ADMIN'],
    kural: 'Kupon oluşturma onay ister.',
  },
  PERMANENT_BAN: {
    ad: 'Kalıcı engelleme',
    permission: 'hesap.kalici_engelle',
    approvers: ['OWNER', 'ADMIN', 'MODERATOR'],
    kural: 'Kalıcı engelleme ajan önerisiyle, insan onayıyla yapılır.',
  },
  ACCOUNT_DELETE: {
    ad: 'Hesap silme',
    permission: 'kvkk.yanitla',
    approvers: ['OWNER', 'ADMIN'],
    kural: 'Hesap silme sahip veya yönetici onayı ister.',
  },
  CATEGORY_SCHEMA: {
    ad: 'Kategori şeması',
    permission: 'kategori.ayarla',
    approvers: ['OWNER', 'ADMIN'],
    kural: 'Kategori ve alan değişikliği dört göz onayıyla yayınlanır (Karar 45).',
  },
};

/** Bekleyen onayın geçerlilik süresi; sonra kendiliğinden düşer. */
export const APPROVAL_TTL_HOURS = 7 * 24;

// ── Yönetim girişi ─────────────────────────────────────────────

/** 30 dakika işlem yapılmazsa oturum kapanır (Karar 40). */
export const STAFF_IDLE_MINUTES = 30;
/** Hareket olsa da oturum en fazla bu kadar açık kalır. */
export const STAFF_SESSION_MAX_HOURS = 12;
/** Davet 48 saat geçerlidir (tasarım: Çalışanlar). */
export const STAFF_INVITE_HOURS = 48;

export const totpCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ''))
  .pipe(
    z.union([
      z.string().regex(/^\d{6}$/),
      z
        .string()
        .regex(/^[a-z0-9]{4}-?[a-z0-9]{4}$/i)
        .transform((v) => v.replace('-', '').toLowerCase()),
    ]),
  );

export const staffInviteSchema = z
  .object({
    email: z
      .email('Geçerli bir e-posta gir')
      .max(254)
      .transform((v) => v.toLowerCase()),
    /** İsteğe bağlı: verilmezse ilk Google girişinde hesaptaki ad yazılır (tasarımdaki davet: e-posta ve rol) */
    name: z.string().trim().min(2, 'En az 2 karakter').max(80).optional(),
    role: z.enum([...INVITABLE_ROLES, 'CUSTOM']),
    customRoleId: z.uuid().optional(),
  })
  .strict()
  .refine((v) => (v.role === 'CUSTOM') === Boolean(v.customRoleId), {
    message: 'Özel rol için rol seçilmeli',
    path: ['customRoleId'],
  });

export const staffRoleChangeSchema = z
  .object({ role: z.enum([...INVITABLE_ROLES, 'CUSTOM']), customRoleId: z.uuid().optional() })
  .strict()
  .refine((v) => (v.role === 'CUSTOM') === Boolean(v.customRoleId), {
    message: 'Özel rol için rol seçilmeli',
    path: ['customRoleId'],
  });

export const customRoleSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    permissions: z.partialRecord(
      z.enum(PERMISSION_KEYS as [Permission, ...Permission[]]),
      z.enum(PERMISSION_LEVELS),
    ),
  })
  .strict()
  .refine((v) => !ownerOnlyViolation(v.permissions), {
    message: 'Çalışan yönetimi ve iadede tam yetki yalnızca sahibe aittir',
    path: ['permissions'],
  });

export const approvalDecisionSchema = z.object({ note: z.string().trim().max(500).optional() }).strict();

/** Konsolda e-posta ve IP gibi kişisel verinin maskeli gösterimi. */
export function maskEmail(email: string): string {
  const [user = '', domain = ''] = email.split('@');
  return `${user.slice(0, 2)}${'•'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

export function maskIp(ip: string): string {
  if (ip.includes(':')) return `${ip.split(':').slice(0, 3).join(':')}:••••`;
  const p = ip.split('.');
  return p.length === 4 ? `${p[0]}.${p[1]}.•.•` : '•••';
}
