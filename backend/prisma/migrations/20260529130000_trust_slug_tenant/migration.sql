-- AlterTable
ALTER TABLE "Trust" ADD COLUMN "slug" TEXT,
ADD COLUMN "custom_domain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Trust_slug_key" ON "Trust"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Trust_custom_domain_key" ON "Trust"("custom_domain");

-- Backfill default tenant slug
UPDATE "Trust" SET "slug" = 'sanwaliya-seth-deoli' WHERE "id" = 'clsanwaliya001' AND "slug" IS NULL;
