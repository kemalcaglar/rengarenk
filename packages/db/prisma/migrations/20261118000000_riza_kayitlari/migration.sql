-- Rıza kayıtları ve sürümlü yasal metinler (Karar 39, 46; Teknik tasarım: consents, consent_texts).
CREATE TABLE "consent_texts" (
  "id" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'taslak',
  "material" BOOLEAN NOT NULL DEFAULT false,
  "created_by" UUID,
  "published_by" UUID,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_texts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consent_texts_status_check" CHECK ("status" IN ('taslak', 'yayinda', 'eski')),
  CONSTRAINT "consent_texts_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "consent_texts_key_version_key" ON "consent_texts"("key", "version");
-- Bir metnin aynı anda en çok bir yayındaki sürümü olur
CREATE UNIQUE INDEX "consent_texts_one_published" ON "consent_texts"("key") WHERE "status" = 'yayinda';

-- Yayınlanmış ya da eskimiş sürümün metni değişmez; silinmez (kullanıcı hangi metni onayladıysa o kalır)
CREATE OR REPLACE FUNCTION rr_consent_text_frozen() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'consent_texts kayıtları silinmez' USING ERRCODE = 'RR040';
  END IF;
  IF OLD.status <> 'taslak' AND (NEW.body <> OLD.body OR NEW.title <> OLD.title OR NEW.version <> OLD.version OR NEW.key <> OLD.key) THEN
    RAISE EXCEPTION 'Yayınlanmış yasal metin değiştirilemez; yeni sürüm açın' USING ERRCODE = 'RR041';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER consent_texts_frozen BEFORE UPDATE OR DELETE ON "consent_texts"
  FOR EACH ROW EXECUTE FUNCTION rr_consent_text_frozen();

CREATE TABLE "consents" (
  "id" UUID NOT NULL,
  "user_id" UUID,
  "visitor_id" TEXT,
  "kind" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "text_key" TEXT,
  "text_version" INTEGER,
  "channel" TEXT NOT NULL,
  "ip" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "consents_subject_check" CHECK ("user_id" IS NOT NULL OR "visitor_id" IS NOT NULL),
  CONSTRAINT "consents_channel_check" CHECK ("channel" IN ('web', 'ios', 'android')),
  CONSTRAINT "consents_kind_check" CHECK ("kind" IN ('kullanim_kosullari', 'kvkk_aydinlatma', 'ticari_ileti', 'reklam_olcum', 'cerez_analiz', 'cerez_reklam'))
);
CREATE INDEX "consents_user_id_kind_created_at_idx" ON "consents"("user_id", "kind", "created_at");
CREATE INDEX "consents_visitor_id_idx" ON "consents"("visitor_id");
CREATE TRIGGER consents_append_only BEFORE UPDATE OR DELETE ON "consents"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
