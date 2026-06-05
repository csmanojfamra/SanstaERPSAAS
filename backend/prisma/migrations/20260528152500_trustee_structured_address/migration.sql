-- Add structured address fields to Trustee
ALTER TABLE "Trustee"
ADD COLUMN "address_line1" TEXT,
ADD COLUMN "address_line2" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "pincode" TEXT;
