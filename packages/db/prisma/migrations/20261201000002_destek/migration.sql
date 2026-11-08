-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "no" SERIAL NOT NULL,
    "user_id" UUID,
    "email" TEXT,
    "channel" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "reference" TEXT,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'acik',
    "priority" BOOLEAN NOT NULL DEFAULT false,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "first_response_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by" UUID,
    "rating" INTEGER,
    "rating_asked_at" TIMESTAMPTZ(3),
    "last_message_at" TIMESTAMPTZ(3) NOT NULL,
    "user_read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "side" TEXT NOT NULL,
    "staff_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_no_key" ON "support_tickets"("no");

-- CreateIndex
CREATE INDEX "support_tickets_status_due_at_idx" ON "support_tickets"("status", "due_at");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_last_message_at_idx" ON "support_tickets"("user_id", "last_message_at");

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────
-- Elle eklenen kurallar
-- ─────────────────────────────────────────────────────────────
ALTER SEQUENCE "support_tickets_no_seq" RESTART WITH 20001;
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_channel_check" CHECK ("channel" IN ('uygulama', 'eposta'));
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_topic_check"
  CHECK ("topic" IN ('odeme', 'talep', 'dolandiricilik', 'hesap', 'diger'));
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_status_check" CHECK ("status" IN ('acik', 'yanitlandi', 'cozuldu'));
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_rating_check" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_owner_check" CHECK ("user_id" IS NOT NULL OR "email" IS NOT NULL);
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_side_check" CHECK ("side" IN ('kullanici', 'destek'));
-- Destek yazışması silinmez (saklama ve imha süreci ayrıca yönetir, Karar 59)
CREATE TRIGGER support_messages_no_delete BEFORE DELETE ON "support_messages" FOR EACH ROW EXECUTE FUNCTION rr_append_only();
