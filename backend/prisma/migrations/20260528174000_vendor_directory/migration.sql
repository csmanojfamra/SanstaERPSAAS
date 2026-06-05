-- Vendor directory master
CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL,
  "trust_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT,
  "category" TEXT DEFAULT 'GENERAL',
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Expense" ADD COLUMN "vendor_id" TEXT;

CREATE INDEX "Vendor_trust_id_is_active_idx" ON "Vendor"("trust_id", "is_active");
CREATE UNIQUE INDEX "Vendor_trust_id_name_mobile_key" ON "Vendor"("trust_id", "name", "mobile");

ALTER TABLE "Vendor"
ADD CONSTRAINT "Vendor_trust_id_fkey"
FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Expense"
ADD CONSTRAINT "Expense_vendor_id_fkey"
FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
