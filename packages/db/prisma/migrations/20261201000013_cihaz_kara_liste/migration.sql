-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "install_hash" TEXT;

CREATE INDEX "devices_install_hash_idx" ON "devices"("install_hash");

-- Kurallar
ALTER TABLE "blocklist" DROP CONSTRAINT "blocklist_kind_check";
ALTER TABLE "blocklist" ADD CONSTRAINT "blocklist_kind_check" CHECK ("kind" IN ('telefon', 'iban', 'ip', 'cihaz'));
