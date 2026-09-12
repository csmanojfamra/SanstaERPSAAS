-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'CORPUS', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('RECEIPT', 'PAYMENT', 'JOURNAL', 'OPENING', 'CONTRA');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL DEFAULT 'DEBIT',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expense_category" TEXT,
    "purpose_key" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "entry_number" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "voucher_type" "VoucherType" NOT NULL DEFAULT 'JOURNAL',
    "narration" TEXT,
    "source_type" TEXT,
    "source_id" TEXT,
    "fy" TEXT,
    "created_by" TEXT,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "narration" TEXT,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Account_trust_id_account_type_idx" ON "Account"("trust_id", "account_type");

-- CreateIndex
CREATE INDEX "Account_trust_id_is_active_idx" ON "Account"("trust_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Account_trust_id_code_key" ON "Account"("trust_id", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_trust_id_entry_date_idx" ON "JournalEntry"("trust_id", "entry_date");

-- CreateIndex
CREATE INDEX "JournalEntry_trust_id_fy_idx" ON "JournalEntry"("trust_id", "fy");

-- CreateIndex
CREATE INDEX "JournalEntry_trust_id_source_type_source_id_idx" ON "JournalEntry"("trust_id", "source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_trust_id_entry_number_key" ON "JournalEntry"("trust_id", "entry_number");

-- CreateIndex
CREATE INDEX "JournalLine_journal_entry_id_idx" ON "JournalLine"("journal_entry_id");

-- CreateIndex
CREATE INDEX "JournalLine_account_id_idx" ON "JournalLine"("account_id");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
