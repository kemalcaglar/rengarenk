import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StaffRole } from '@rengarenk/db';
import { type CategoryDefinition, DOTS } from '@rengarenk/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApprovalExecutor } from '../src/approvals/approval-executor.js';
import type { Db } from '../src/database/prisma.js';
import { createTestApp } from './helpers.js';
import { createStaff, loginAs, staffCall } from './staff-helpers.js';

let app: NestFastifyApplication;
let db: Db;
let executor: ApprovalExecutor;

beforeAll(async () => {
  ({ app, db } = await createTestApp());
  executor = app.get(ApprovalExecutor);
});
afterAll(() => app.close());

const pgCode = (e: unknown) => String((e as Error)?.message).match(/Code: `(RR0\d\d)`/)?.[1];

async function token(role: Exclude<StaffRole, 'CUSTOM' | 'CATALOG'>) {
  const staff = await createStaff(db, role);
  return { staff, token: (await loginAs(app, staff)).token };
}

interface TreeRow {
  id: string;
  slug: string;
  enabled: boolean;
  draft: { version: number; status: string; changes: number } | null;
  published: { version: number } | null;
}

async function categoryId(t: string, slug: string) {
  const list = await staffCall(app, 'GET', '/staff/categories', undefined, t);
  return (list.body as TreeRow[]).find((c) => c.slug === slug)?.id as string;
}

describe('kategoriler (Karar 23, 45)', () => {
  it('ilk kurulumda 14 vasıta kategorisi 1. sürümle yayında; menü açık kategorileri sırasıyla verir', async () => {
    const res = await app.inject({ method: 'GET', url: '/categories' });
    expect(res.statusCode).toBe(200);
    const tree = res.json() as {
      slug: string;
      color: string;
      version: number;
      children: { slug: string }[];
    }[];
    expect(tree).toHaveLength(14);
    expect(tree[0]).toMatchObject({ slug: 'otomobil', color: DOTS[0], version: 1 });
    expect(tree[7]?.color).toBe(DOTS[1]);
    const ticari = tree.find((c) => c.slug === 'ticari');
    expect(ticari?.children.map((c) => c.slug)).toContain('kamyon-cekici');
    // Ticari Hat & Plaka avukat görüşüne kadar kapalı (Karar 19)
    expect(ticari?.children.map((c) => c.slug)).not.toContain('ticari-hat-plaka');

    const schema = await app.inject({ method: 'GET', url: '/categories/otomobil/schema' });
    const body = schema.json();
    expect(body.version).toBe(1);
    expect(body.fields.slice(0, 3).map((f: { key: string }) => f.key)).toEqual([
      'konum',
      'butce',
      'aciklama',
    ]);
    expect(body.jsonSchema.properties.alternatifler.type).toBe('array');
    const closed = await app.inject({ method: 'GET', url: '/categories/ticari-hat-plaka/schema' });
    expect(closed.statusCode).toBe(404);
  });

  it('yalnızca sahip ve yönetici kategori ayarlar', async () => {
    const mod = await token('MODERATOR');
    expect((await staffCall(app, 'GET', '/staff/categories', undefined, mod.token)).status).toBe(403);
  });

  it('taslak → onaya gönder → başkası onaylar → yayında; eski talepler eski sürümü okur; eski sürüme dönülür', async () => {
    const admin = await token('ADMIN');
    const owner = await token('OWNER');
    const id = await categoryId(admin.token, 'otomobil');

    const d = await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, admin.token);
    expect(d.body.draft).toBeNull();
    const def = structuredClone(d.body.published.definition) as CategoryDefinition;
    const km = def.fields.find((f) => f.key === 'km');
    if (km) km.filter = true;
    def.fields.push({
      key: 'garanti',
      label: 'Garantisi devam ediyor',
      type: 'boolean',
      required: false,
      filter: true,
      hard: 'no',
      weight: 4,
      source: 'alici',
      step: 'kriterler',
      scope: 'alternatif',
    });

    const bad = await staffCall(
      app,
      'PUT',
      `/staff/categories/${id}/draft`,
      { ...def, fields: [...def.fields, def.fields[0]] },
      admin.token,
    );
    expect(bad.status).toBe(400);

    const saved = await staffCall(app, 'PUT', `/staff/categories/${id}/draft`, def, admin.token);
    expect(saved.status).toBe(200);
    expect(saved.body).toEqual({
      version: 2,
      changes: ['Kilometre (en çok) · filtrede: hayır → evet', 'Garantisi devam ediyor alanı eklendi'],
    });

    const sent = await staffCall(app, 'POST', `/staff/categories/${id}/draft/submit`, undefined, admin.token);
    expect(sent.status).toBe(200);
    const approvalId = sent.body.approvalId as string;

    // Onaydaki taslak değişmez; isteyen yönetici kendi isteğini onaylayamaz
    expect((await staffCall(app, 'PUT', `/staff/categories/${id}/draft`, def, admin.token)).status).toBe(409);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, admin.token)).status,
    ).toBe(403);
    const queue = await staffCall(app, 'GET', '/staff/approvals', undefined, owner.token);
    const item = queue.body.find((x: { id: string }) => x.id === approvalId);
    expect(item).toMatchObject({ kind: 'CATEGORY_SCHEMA', title: 'Otomobil şeması s.2', canDecide: true });

    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${approvalId}/approve`, {}, owner.token)).status,
    ).toBe(200);
    expect(await executor.execute(approvalId)).toBe('yurutuldu');
    expect(await executor.execute(approvalId)).toBe('zaten_yurutuldu');

    const now = await app.inject({ method: 'GET', url: '/categories/otomobil/schema' });
    expect(now.json().version).toBe(2);
    expect(now.json().fields.map((f: { key: string }) => f.key)).toContain('garanti');
    const old = await app.inject({ method: 'GET', url: '/categories/otomobil/schema?surum=1' });
    expect(old.json().fields.map((f: { key: string }) => f.key)).not.toContain('garanti');

    const after = await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, admin.token);
    expect(
      after.body.versions.map((v: { version: number; status: string }) => `${v.version}:${v.status}`),
    ).toEqual(['2:PUBLISHED', '1:RETIRED']);
    expect(after.body.versions[0].publishedBy.id).toBe(owner.staff.id);
    expect(after.body.versions[0].createdBy.id).toBe(admin.staff.id);

    const back = await staffCall(
      app,
      'POST',
      `/staff/categories/${id}/versions/1/restore`,
      undefined,
      admin.token,
    );
    expect(back.status).toBe(200);
    expect(back.body.version).toBe(3);
    expect(back.body.changes[0]).toBe('s.1 sürümüne dönüş');
    expect(back.body.changes).toContain('Garantisi devam ediyor alanı kaldırıldı');

    const actions = await db.auditLog.findMany({ where: { entityId: id }, select: { action: true } });
    expect(actions.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'kategori_taslak_kaydedildi',
        'kategori_yayina_gonderildi',
        'kategori_yayinlandi',
        'kategori_surume_donuldu',
      ]),
    );
    const evt = await db.outboxEvent.findFirst({ where: { type: 'kategori.yayinlandi' } });
    expect(evt?.payload).toMatchObject({ categoryId: id, version: 2 });

    // Taslak silinir; yayındaki sürüm kalır
    expect(
      (await staffCall(app, 'DELETE', `/staff/categories/${id}/draft`, undefined, admin.token)).status,
    ).toBe(204);
    expect(
      (await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, admin.token)).body.draft,
    ).toBeNull();
  });

  it('reddedilen taslak yeniden düzenlenebilir olur', async () => {
    const admin = await token('ADMIN');
    const owner = await token('OWNER');
    const id = await categoryId(admin.token, 'motosiklet');
    const d = await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, admin.token);
    const def = structuredClone(d.body.published.definition) as CategoryDefinition;
    def.rules.listingDays = 45;
    await staffCall(app, 'PUT', `/staff/categories/${id}/draft`, def, admin.token);
    const sent = await staffCall(app, 'POST', `/staff/categories/${id}/draft/submit`, undefined, admin.token);
    expect(
      (await staffCall(app, 'POST', `/staff/approvals/${sent.body.approvalId}/reject`, {}, owner.token))
        .status,
    ).toBe(200);

    const again = await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, admin.token);
    expect(again.body.draft).toMatchObject({ status: 'DRAFT', approval: null });
    def.rules.listingDays = 60;
    const saved = await staffCall(app, 'PUT', `/staff/categories/${id}/draft`, def, admin.token);
    expect(saved.body.changes).toEqual(['Yayın süresi: 30 gün → 60 gün']);
  });

  it('kategori ekleme, açma ve sıralama; yayında sürümü olmayan kategori açılamaz', async () => {
    const owner = await token('OWNER');
    const created = await staffCall(
      app,
      'POST',
      '/staff/categories',
      { name: 'Konut', vertical: 'emlak' },
      owner.token,
    );
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: 'konut', vertical: 'emlak', enabled: false });
    const open = await staffCall(
      app,
      'PATCH',
      `/staff/categories/${created.body.id}`,
      { enabled: true },
      owner.token,
    );
    expect(open.status).toBe(409);

    const moto = await categoryId(owner.token, 'motosiklet');
    const ev = await categoryId(owner.token, 'elektrikli');
    const moved = await staffCall(app, 'PATCH', `/staff/categories/${moto}`, { move: 'up' }, owner.token);
    expect(moved.status).toBe(200);
    const tree = (await app.inject({ method: 'GET', url: '/categories' })).json() as { slug: string }[];
    expect(tree.slice(2, 4).map((c) => c.slug)).toEqual(['motosiklet', 'elektrikli']);
    await staffCall(app, 'PATCH', `/staff/categories/${ev}`, { move: 'up' }, owner.token);

    const off = await staffCall(app, 'PATCH', `/staff/categories/${moto}`, { enabled: false }, owner.token);
    expect(off.body.enabled).toBe(false);
    expect(((await app.inject({ method: 'GET', url: '/categories' })).json() as unknown[]).length).toBe(13);
    await staffCall(app, 'PATCH', `/staff/categories/${moto}`, { enabled: true }, owner.token);
  });

  it('veritabanı kilidi: yayındaki sürüm değişmez, silinmez, onaysız yayına girmez', async () => {
    const v = await db.categorySchemaVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' } });
    await expect(
      db.categorySchemaVersion.update({ where: { id: v.id }, data: { definition: { fields: [] } } }),
    ).rejects.toSatisfy((e) => pgCode(e) === 'RR031');
    await expect(db.categorySchemaVersion.delete({ where: { id: v.id } })).rejects.toSatisfy(
      (e) => pgCode(e) === 'RR030',
    );
    await expect(
      db.categorySchemaVersion.update({ where: { id: v.id }, data: { status: 'DRAFT' } }),
    ).rejects.toSatisfy((e) => pgCode(e) === 'RR033');

    const owner = await token('OWNER');
    const id = await categoryId(owner.token, 'karavan');
    const d = await staffCall(app, 'GET', `/staff/categories/${id}`, undefined, owner.token);
    const def = structuredClone(d.body.published.definition) as CategoryDefinition;
    def.rules.freeFirstMessages = 3;
    await staffCall(app, 'PUT', `/staff/categories/${id}/draft`, def, owner.token);
    const draft = await db.categorySchemaVersion.findFirstOrThrow({
      where: { categoryId: id, status: 'DRAFT' },
    });
    await expect(
      db.categorySchemaVersion
        .update({ where: { id: draft.id }, data: { status: 'PENDING' } })
        .then(() =>
          db.categorySchemaVersion.update({ where: { id: draft.id }, data: { status: 'PUBLISHED' } }),
        ),
    ).rejects.toSatisfy((e) => pgCode(e) === 'RR032');
    await expect(db.category.delete({ where: { id } })).rejects.toSatisfy((e) => pgCode(e) === 'RR001');
  });
});
