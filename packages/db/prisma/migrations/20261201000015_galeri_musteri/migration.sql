-- AlterTable
ALTER TABLE "galleries" ADD COLUMN     "manager_set_at" TIMESTAMPTZ(3),
ADD COLUMN     "manager_staff_id" UUID;

CREATE INDEX "galleries_manager_staff_id_idx" ON "galleries"("manager_staff_id");
