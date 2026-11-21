-- İYS izinleri elle aktarılır (sahip kararı, 21 Kasım 2026; Karar 49): entegratör yokken ticari ileti onay ve retleri
-- kanal başına kaydedilir, konsoldan Excel olarak indirilip İYS paneline yüklenir. Satırlar onayın ispatıdır, silinmez.

CREATE TABLE "iys_batches" (
  "id" UUID NOT NULL,
  "no" SERIAL NOT NULL,
  "count" INTEGER NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "uploaded_by" UUID,
  "uploaded_at" TIMESTAMPTZ(3),
  CONSTRAINT "iys_batches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "iys_batches_no_key" ON "iys_batches"("no");
CREATE TRIGGER iys_batches_no_delete BEFORE DELETE ON "iys_batches"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();

CREATE TABLE "iys_records" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "recipient_type" TEXT NOT NULL DEFAULT 'BIREYSEL',
  "consent_at" TIMESTAMPTZ(3) NOT NULL,
  "batch_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iys_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "iys_records_type_check" CHECK ("type" IN ('EPOSTA', 'MESAJ')),
  CONSTRAINT "iys_records_status_check" CHECK ("status" IN ('ONAY', 'RET')),
  CONSTRAINT "iys_records_source_check" CHECK ("source" IN ('HS_WEB', 'HS_MOBIL')),
  CONSTRAINT "iys_records_recipient_type_check" CHECK ("recipient_type" IN ('BIREYSEL', 'TACIR'))
);
CREATE INDEX "iys_records_user_id_type_created_at_idx" ON "iys_records"("user_id", "type", "created_at");
CREATE INDEX "iys_records_batch_id_idx" ON "iys_records"("batch_id");
ALTER TABLE "iys_records" ADD CONSTRAINT "iys_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iys_records" ADD CONSTRAINT "iys_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "iys_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE TRIGGER iys_records_no_delete BEFORE DELETE ON "iys_records"
  FOR EACH ROW EXECUTE FUNCTION rr_append_only();
