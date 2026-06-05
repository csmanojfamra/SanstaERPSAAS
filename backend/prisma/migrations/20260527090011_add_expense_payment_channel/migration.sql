-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('CASH', 'BANK');

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "payment_channel" "PaymentChannel" NOT NULL DEFAULT 'CASH';
