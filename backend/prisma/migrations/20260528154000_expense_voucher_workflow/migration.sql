-- Extend Expense for voucher workflow and audit-ready metadata
ALTER TABLE "Expense"
ADD COLUMN "voucher_number" TEXT,
ADD COLUMN "expense_nature" TEXT DEFAULT 'OPERATIONAL',
ADD COLUMN "vendor_mobile" TEXT,
ADD COLUMN "payment_mode" "PaymentMode" DEFAULT 'CASH',
ADD COLUMN "upi_ref" TEXT,
ADD COLUMN "cheque_number" TEXT,
ADD COLUMN "transaction_id" TEXT;

-- Add new category values for trust accounting UX
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'LABOUR_CONSTRUCTION';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'RELIGIOUS_ACTIVITIES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'TEMPLE_MAINTENANCE';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'UTILITIES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'PRASAD_FOOD_DISTRIBUTION';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'FESTIVAL_EXPENSES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'ADMINISTRATIVE_EXPENSES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'SALARY_WAGES';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'LEGAL_PROFESSIONAL';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'CHARITY_RELIEF';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'BANK_CHARGES';

-- Unique voucher number per trust (nullable-friendly)
CREATE UNIQUE INDEX "Expense_trust_id_voucher_number_key" ON "Expense"("trust_id", "voucher_number");
