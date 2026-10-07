-- AlterTable
ALTER TABLE "Trust" ADD COLUMN "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Trust" ADD COLUMN "whatsapp_account" TEXT;
ALTER TABLE "Trust" ADD COLUMN "whatsapp_template" TEXT;

-- CreateTable
CREATE TABLE "PlatformWhatsApp" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "base_url" TEXT NOT NULL DEFAULT 'https://wa.fastlegal.in',
    "api_key" TEXT NOT NULL DEFAULT '',
    "account_name" TEXT NOT NULL DEFAULT 'fastlegal',
    "template_name" TEXT NOT NULL DEFAULT 'donation_receipt',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWhatsApp_pkey" PRIMARY KEY ("id")
);
