-- Kategori ağacı ve sürümlü kategori şeması (Karar 23, 45; Teknik tasarım §4–5).
-- Elle yazıldı: tetikleyiciler Prisma şemasında ifade edilemez.

ALTER TYPE "ApprovalKind" ADD VALUE 'CATEGORY_SCHEMA';

CREATE TYPE "CategoryVersionStatus" AS ENUM ('DRAFT', 'PENDING', 'PUBLISHED', 'RETIRED');

CREATE TABLE "categories" (
  "id" UUID NOT NULL,
  "slug" TEXT NOT NULL,
  "vertical" TEXT NOT NULL DEFAULT 'vasita',
  "parent_id" UUID,
  "name" TEXT NOT NULL,
  "sort" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "color" TEXT,
  "published_version" INTEGER,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "categories_vertical_check" CHECK ("vertical" IN ('vasita', 'emlak', 'ikinci_el')),
  CONSTRAINT "categories_slug_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT "categories_color_check" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'),
  -- Yayında sürümü olmayan kategori açılamaz
  CONSTRAINT "categories_enabled_check" CHECK (NOT "enabled" OR "published_version" IS NOT NULL)
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
CREATE INDEX "categories_parent_id_sort_idx" ON "categories"("parent_id", "sort");
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "category_schema_versions" (
  "id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "CategoryVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "definition" JSONB NOT NULL,
  "changes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "restored_from" INTEGER,
  "created_by" UUID,
  "approval_id" UUID,
  "published_by" UUID,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "category_schema_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "category_schema_versions_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "category_schema_versions_category_id_version_key" ON "category_schema_versions"("category_id", "version");
CREATE UNIQUE INDEX "category_schema_versions_approval_id_key" ON "category_schema_versions"("approval_id");
-- Kategori başına bir yayındaki sürüm ve bir açık taslak (taslak ya da onayda)
CREATE UNIQUE INDEX "category_schema_versions_one_published" ON "category_schema_versions"("category_id") WHERE "status" = 'PUBLISHED';
CREATE UNIQUE INDEX "category_schema_versions_one_draft" ON "category_schema_versions"("category_id") WHERE "status" IN ('DRAFT', 'PENDING');
ALTER TABLE "category_schema_versions" ADD CONSTRAINT "category_schema_versions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Sürüm kilidi:
--  RR030 yalnızca taslak silinir (yayına girmiş sürüm geçmişte kalır, "Bu sürüme dön" için gerekir)
--  RR031 taslak dışındaki sürümün tanımı değişmez
--  RR032 sürüm, onaylanmış dört göz isteği olmadan yayına giremez (ilk kurulumdaki 1. sürüm hariç)
--  RR033 geçersiz durum geçişi (yayından yalnızca "eski"ye; eski sürüm geri gelmez, yeni taslakla dönülür)
CREATE OR REPLACE FUNCTION rr_category_version_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT' THEN
      RAISE EXCEPTION 'yalnızca taslak sürüm silinebilir' USING ERRCODE = 'RR030';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'DRAFT' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version <> OLD.version
        OR NEW.category_id <> OLD.category_id) THEN
      RAISE EXCEPTION 'taslak dışındaki kategori sürümü değiştirilemez' USING ERRCODE = 'RR031';
    END IF;
    IF (OLD.status = 'RETIRED' AND NEW.status <> 'RETIRED')
        OR (OLD.status = 'PUBLISHED' AND NEW.status NOT IN ('PUBLISHED', 'RETIRED'))
        OR (OLD.status = 'DRAFT' AND NEW.status NOT IN ('DRAFT', 'PENDING'))
        OR (OLD.status = 'PENDING' AND NEW.status NOT IN ('PENDING', 'DRAFT', 'PUBLISHED')) THEN
      RAISE EXCEPTION 'kategori sürümü % durumundan % durumuna geçemez', OLD.status, NEW.status USING ERRCODE = 'RR033';
    END IF;
  END IF;
  IF NEW.status = 'PUBLISHED' AND (TG_OP = 'INSERT' OR OLD.status <> 'PUBLISHED') THEN
    IF NEW.approval_id IS NULL THEN
      IF NOT (TG_OP = 'INSERT' AND NEW.version = 1 AND NEW.created_by IS NULL) THEN
        RAISE EXCEPTION 'kategori sürümü onaysız yayınlanamaz' USING ERRCODE = 'RR032';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM approvals a
      WHERE a.id = NEW.approval_id AND a.kind::text = 'CATEGORY_SCHEMA' AND a.status = 'APPROVED'
        AND a.subject_type = 'category_schema_version' AND a.subject_id = NEW.id::text
    ) THEN
      RAISE EXCEPTION 'kategori sürümü onaysız yayınlanamaz' USING ERRCODE = 'RR032';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER category_schema_versions_guard BEFORE INSERT OR UPDATE OR DELETE ON "category_schema_versions"
  FOR EACH ROW EXECUTE FUNCTION rr_category_version_guard();

-- Kategori silinmez; kapatılır (eski talepler kategorisini ve şema sürümünü taşır)
CREATE TRIGGER categories_no_delete BEFORE DELETE ON "categories"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
