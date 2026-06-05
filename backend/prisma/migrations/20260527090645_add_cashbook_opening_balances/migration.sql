-- AlterTable
ALTER TABLE "Trust" ADD COLUMN     "opening_bank_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "opening_cash_balance" DECIMAL(12,2) NOT NULL DEFAULT 0;
