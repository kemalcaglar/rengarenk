import { SetMetadata } from '@nestjs/common';
import type { StaffCustomRole, StaffMember } from '@rengarenk/db';
import {
  type BuiltinRole,
  ownerOnlyViolation,
  PERMISSION_KEYS,
  PERMISSION_LEVELS,
  type Permission,
  type PermissionGrants,
  type PermissionLevel,
  ROLE_GRANTS,
} from '@rengarenk/shared';

/**
 * Her yönetim uç noktası ya bir izin ister (`RequirePermission`), ya yalnızca giriş yapmış çalışan
 * ister (`StaffOnly`), ya da açıkça herkese açıktır (`StaffPublic`, yalnızca giriş adımları).
 * İşaretsiz uç nokta StaffGuard tarafından reddedilir; ayrıca bir test tüm /staff uçlarını tarar.
 */
export const STAFF_ACCESS = 'rr:yonetim_erisim';

export type StaffAccess =
  | { kind: 'permission'; permission: Permission; level: PermissionLevel }
  | { kind: 'staff' }
  | { kind: 'public' };

export const RequirePermission = (permission: Permission, level: PermissionLevel = 'tam') =>
  SetMetadata(STAFF_ACCESS, { kind: 'permission', permission, level } satisfies StaffAccess);

export const StaffOnly = () => SetMetadata(STAFF_ACCESS, { kind: 'staff' } satisfies StaffAccess);

export const StaffPublic = () => SetMetadata(STAFF_ACCESS, { kind: 'public' } satisfies StaffAccess);

/** Çalışanın yetkileri: hazır rolde matristen, özel rolde rol kaydından. */
export function grantsFor(staff: StaffMember & { customRole?: StaffCustomRole | null }): PermissionGrants {
  if (staff.role === 'CUSTOM') return sanitizeGrants(staff.customRole?.permissions);
  if (staff.role === 'CATALOG') return {};
  return { ...ROLE_GRANTS[staff.role as BuiltinRole] };
}

/** Veritabanından gelen özel rol yetkilerini tanımlı anahtar ve düzeylerle sınırlar. */
export function sanitizeGrants(raw: unknown): PermissionGrants {
  const out: PermissionGrants = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (PERMISSION_KEYS.includes(k as Permission) && PERMISSION_LEVELS.includes(v as PermissionLevel)) {
      out[k as Permission] = v as PermissionLevel;
    }
  }
  // Sahibe ait yetkiler özel role hiçbir yoldan geçmez.
  if (ownerOnlyViolation(out)) {
    delete out['ekip.yonet'];
    if (out.iade === 'tam') out.iade = 'oneri';
  }
  return out;
}
