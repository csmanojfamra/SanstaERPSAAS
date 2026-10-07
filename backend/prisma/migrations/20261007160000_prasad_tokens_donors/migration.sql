-- Donor directory so a name typed once can be found on the next receipt.
CREATE TABLE "Donor" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "city" TEXT,
    "email" TEXT,
    "address" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "donor_type" TEXT DEFAULT 'INDIVIDUAL',
    "pan_number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Donor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Donor_trust_id_mobile_key" ON "Donor"("trust_id", "mobile");
CREATE INDEX "Donor_trust_id_name_idx" ON "Donor"("trust_id", "name");

ALTER TABLE "Donor" ADD CONSTRAINT "Donor_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One-time prasad counter token. The QR opens /p/:code on a normal phone camera.
CREATE TABLE "PrasadToken" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "donor_name" TEXT NOT NULL,
    "donor_mobile" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "packets" INTEGER NOT NULL,
    "rupees_per_packet" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "issued_by" TEXT,
    "redeemed_at" TIMESTAMP(3),
    "whatsapp_sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrasadToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrasadToken_code_key" ON "PrasadToken"("code");
CREATE INDEX "PrasadToken_trust_id_created_at_idx" ON "PrasadToken"("trust_id", "created_at");

ALTER TABLE "PrasadToken" ADD CONSTRAINT "PrasadToken_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
