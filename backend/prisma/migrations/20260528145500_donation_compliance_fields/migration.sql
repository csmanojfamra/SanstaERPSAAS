-- Add optional compliance-ready donation fields
ALTER TABLE "Donation"
ADD COLUMN "donor_address" TEXT,
ADD COLUMN "donor_state" TEXT,
ADD COLUMN "donor_pincode" TEXT,
ADD COLUMN "donor_type" TEXT DEFAULT 'INDIVIDUAL',
ADD COLUMN "is_corpus" BOOLEAN NOT NULL DEFAULT false;
