-- Üyelik ve giriş (Karar 18, 12 Kasım 2026): e-posta ve şifre, Google ve Apple ile giriş; telefon üyelikte bir kez.

-- E-posta tekil ve küçük harfle. Aynı adres birden çok hesapta varsa yalnızca en eski hesapta kalır (yalnızca deneme verisi).
UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" IS NOT NULL;
UPDATE "users" SET "email" = NULL WHERE "email" = '';
UPDATE "users" u SET "email" = NULL, "email_verified_at" = NULL
WHERE u."email" IS NOT NULL AND EXISTS (SELECT 1 FROM "users" o WHERE o."email" = u."email" AND o."id" < u."id");

ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
ALTER TABLE "users" ADD COLUMN "apple_sub" TEXT;
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");
CREATE UNIQUE INDEX "users_apple_sub_key" ON "users"("apple_sub");

ALTER TABLE "email_challenges" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'dogrulama';

CREATE TABLE "pending_signups" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hash" TEXT,
    "provider" TEXT,
    "provider_sub" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "consents" JSONB NOT NULL,
    "platform" TEXT NOT NULL,
    "install_hash" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pending_signups_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pending_signups_expires_at_idx" ON "pending_signups"("expires_at");

CREATE TABLE "user_oauth_challenges" (
    "id" UUID NOT NULL,
    "state_hash" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "code_verifier" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_oauth_challenges_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "user_oauth_challenges_state_hash_key" ON "user_oauth_challenges"("state_hash");
CREATE INDEX "user_oauth_challenges_expires_at_idx" ON "user_oauth_challenges"("expires_at");
