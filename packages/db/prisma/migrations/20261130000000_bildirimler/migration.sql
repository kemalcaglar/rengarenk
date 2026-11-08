-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sablon" TEXT NOT NULL,
    "grup" TEXT NOT NULL,
    "baslik" TEXT NOT NULL,
    "metin" TEXT NOT NULL,
    "url" TEXT,
    "ticari" BOOLEAN NOT NULL DEFAULT false,
    "tekil" TEXT,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_prefs" (
    "user_id" UUID NOT NULL,
    "konu" TEXT NOT NULL,
    "kanal" TEXT NOT NULL,
    "acik" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("user_id","konu","kanal")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" UUID NOT NULL,
    "notification_id" UUID,
    "user_id" UUID,
    "staff_id" UUID,
    "kanal" TEXT NOT NULL,
    "sablon" TEXT NOT NULL,
    "sablon_surum" INTEGER NOT NULL,
    "ticari" BOOLEAN NOT NULL DEFAULT false,
    "durum" TEXT NOT NULL DEFAULT 'bekliyor',
    "neden" TEXT,
    "kosul" TEXT,
    "veri" JSONB NOT NULL DEFAULT '{}',
    "saglayici" TEXT,
    "saglayici_no" TEXT,
    "hedef" TEXT,
    "due_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabled_at" TIMESTAMPTZ(3),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_suppressions" (
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "only_commercial" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "icerik" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("key","version")
);

-- CreateTable
CREATE TABLE "email_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "deliveries_durum_due_at_idx" ON "deliveries"("durum", "due_at");

-- CreateIndex
CREATE INDEX "deliveries_user_id_created_at_idx" ON "deliveries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "deliveries_kanal_created_at_idx" ON "deliveries"("kanal", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "push_tokens_user_id_idx" ON "push_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_challenges_token_hash_key" ON "email_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "email_challenges_user_id_idx" ON "email_challenges"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Elle: aynı konudaki okunmamış bildirim tektir (yeni mesaj aynı satırı günceller)
CREATE UNIQUE INDEX "notifications_user_tekil_okunmamis" ON "notifications"("user_id", "tekil")
  WHERE "tekil" IS NOT NULL AND "read_at" IS NULL;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_grup_check"
  CHECK ("grup" IN ('mesaj', 'talep', 'guvenlik', 'kampanya', 'odeme', 'galeri'));
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_check"
  CHECK ("konu" IN ('mesaj', 'arama', 'sure', 'odeme', 'kampanya', 'galeri') AND "kanal" IN ('uygulama', 'eposta', 'sms'));
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_check"
  CHECK ("kanal" IN ('push', 'eposta', 'sms') AND "durum" IN ('bekliyor', 'gonderildi', 'atlandi', 'hata')
    AND ("user_id" IS NOT NULL OR "staff_id" IS NOT NULL));
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_platform_check" CHECK ("platform" IN ('ios', 'android', 'web'));
-- Teslim kaydı silinmez (Karar 49: İYS ve onay kayıtları 3 yıl)
CREATE TRIGGER deliveries_no_delete BEFORE DELETE ON "deliveries"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE TRIGGER notification_templates_append_only BEFORE UPDATE OR DELETE ON "notification_templates"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
