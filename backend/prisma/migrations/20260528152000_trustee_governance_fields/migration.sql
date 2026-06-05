-- Add governance and compliance fields to Trustee
ALTER TABLE "Trustee"
ADD COLUMN "joining_date" DATE,
ADD COLUMN "pan_number" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "authorized_signatory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "bank_signatory" BOOLEAN NOT NULL DEFAULT false;
