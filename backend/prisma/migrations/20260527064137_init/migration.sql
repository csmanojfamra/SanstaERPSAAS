-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CHEQUE', 'NEFT', 'RTGS', 'DD', 'ONLINE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('CONSTRUCTION', 'MATERIALS', 'LABOUR', 'PUJA', 'ADMIN', 'TRAVEL', 'FOOD', 'OTHER');

-- CreateTable
CREATE TABLE "Trust" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_hindi" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "logo_url" TEXT,
    "receipt_prefix" TEXT NOT NULL DEFAULT 'TRUST',
    "donor_threshold" INTEGER NOT NULL DEFAULT 1100,
    "current_fy" TEXT NOT NULL DEFAULT '2025-26',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_ifsc" TEXT,
    "pan_number" TEXT,
    "reg_number" TEXT,
    "razorpay_key" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#FF6B00',
    "secondary_color" TEXT NOT NULL DEFAULT '#7B1C1C',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trust_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "supabase_uid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "donor_name" TEXT NOT NULL,
    "donor_mobile" TEXT NOT NULL,
    "donor_city" TEXT,
    "donor_email" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL,
    "upi_ref" TEXT,
    "cheque_number" TEXT,
    "bank_ref" TEXT,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "purpose" TEXT NOT NULL DEFAULT 'General Donation',
    "donation_date" DATE NOT NULL,
    "notes" TEXT,
    "receipt_pdf_path" TEXT,
    "receipt_pdf_url" TEXT,
    "receipt_sent_at" TIMESTAMP(3),
    "whatsapp_sent" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp_sent_at" TIMESTAMP(3),
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "gateway_ref" TEXT,
    "gateway_status" TEXT,
    "is_80g_eligible" BOOLEAN NOT NULL DEFAULT false,
    "pan_number" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trustee" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_hindi" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "role" TEXT,
    "photo_url" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trustee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrusteeContribution" (
    "id" TEXT NOT NULL,
    "trustee_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "contribution_date" DATE NOT NULL,
    "payment_mode" "PaymentMode",
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrusteeContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "paid_to" TEXT,
    "reference" TEXT,
    "bank_ref" TEXT,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "attachment_url" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_supabase_uid_key" ON "User"("supabase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_trust_id_username_key" ON "User"("trust_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_trust_id_receipt_number_key" ON "Donation"("trust_id", "receipt_number");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trustee" ADD CONSTRAINT "Trustee_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrusteeContribution" ADD CONSTRAINT "TrusteeContribution_trustee_id_fkey" FOREIGN KEY ("trustee_id") REFERENCES "Trustee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
