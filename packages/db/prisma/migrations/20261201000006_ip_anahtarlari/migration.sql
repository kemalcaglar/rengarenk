-- CreateTable
CREATE TABLE "pii_keys" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "period_end" TIMESTAMPTZ(3) NOT NULL,
    "key_enc" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pii_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pii_keys_purpose_period_end_idx" ON "pii_keys"("purpose", "period_end");


ALTER TABLE "pii_keys" ADD CONSTRAINT "pii_keys_purpose_check" CHECK ("purpose" IN ('islem'));
ALTER TABLE "pii_keys" ADD CONSTRAINT "pii_keys_id_check" CHECK ("id" ~ '^[a-z]+-[0-9]{4}-[12]$');

-- Dönem anahtarı değiştirilemez; yalnızca saklama süresi (2 yıl) dolunca periyodik imhada silinir.
CREATE TRIGGER pii_keys_no_update BEFORE UPDATE ON "pii_keys" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
CREATE FUNCTION rr_pii_key_delete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.period_end > now() - interval '730 days' THEN
    RAISE EXCEPTION 'saklama süresi dolmamış dönem anahtarı silinemez' USING ERRCODE = 'RR040';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER pii_keys_delete_guard BEFORE DELETE ON "pii_keys" FOR EACH ROW EXECUTE FUNCTION rr_pii_key_delete_guard();
