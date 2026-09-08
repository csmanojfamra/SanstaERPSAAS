-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'UTILISE');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "category" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InKindReceipt" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "donor_name" TEXT NOT NULL,
    "donor_mobile" TEXT,
    "donor_city" TEXT,
    "receipt_date" DATE NOT NULL,
    "notes" TEXT,
    "estimated_value" DECIMAL(12,2),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InKindReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InKindReceiptLine" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "description" TEXT,
    "estimated_value" DECIMAL(12,2),

    CONSTRAINT "InKindReceiptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "movement_date" DATE NOT NULL,
    "reason" TEXT,
    "inkind_receipt_id" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentPlan" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentMember" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "city" TEXT,
    "start_date" DATE NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitmentMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentInstallment" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "donation_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitmentInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockItem_trust_id_is_active_idx" ON "StockItem"("trust_id", "is_active");
CREATE UNIQUE INDEX "StockItem_trust_id_name_key" ON "StockItem"("trust_id", "name");

CREATE INDEX "InKindReceipt_trust_id_receipt_date_idx" ON "InKindReceipt"("trust_id", "receipt_date");
CREATE UNIQUE INDEX "InKindReceipt_trust_id_receipt_number_key" ON "InKindReceipt"("trust_id", "receipt_number");

CREATE INDEX "InKindReceiptLine_receipt_id_idx" ON "InKindReceiptLine"("receipt_id");
CREATE INDEX "InKindReceiptLine_stock_item_id_idx" ON "InKindReceiptLine"("stock_item_id");

CREATE INDEX "StockMovement_trust_id_stock_item_id_idx" ON "StockMovement"("trust_id", "stock_item_id");
CREATE INDEX "StockMovement_trust_id_movement_date_idx" ON "StockMovement"("trust_id", "movement_date");

CREATE INDEX "CommitmentPlan_trust_id_is_active_idx" ON "CommitmentPlan"("trust_id", "is_active");
CREATE UNIQUE INDEX "CommitmentPlan_trust_id_code_key" ON "CommitmentPlan"("trust_id", "code");

CREATE INDEX "CommitmentMember_trust_id_status_idx" ON "CommitmentMember"("trust_id", "status");
CREATE INDEX "CommitmentMember_trust_id_mobile_idx" ON "CommitmentMember"("trust_id", "mobile");

CREATE UNIQUE INDEX "CommitmentInstallment_donation_id_key" ON "CommitmentInstallment"("donation_id");
CREATE INDEX "CommitmentInstallment_member_id_payment_date_idx" ON "CommitmentInstallment"("member_id", "payment_date");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InKindReceipt" ADD CONSTRAINT "InKindReceipt_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InKindReceiptLine" ADD CONSTRAINT "InKindReceiptLine_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "InKindReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InKindReceiptLine" ADD CONSTRAINT "InKindReceiptLine_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_inkind_receipt_id_fkey" FOREIGN KEY ("inkind_receipt_id") REFERENCES "InKindReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommitmentPlan" ADD CONSTRAINT "CommitmentPlan_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommitmentMember" ADD CONSTRAINT "CommitmentMember_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommitmentMember" ADD CONSTRAINT "CommitmentMember_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "CommitmentPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommitmentInstallment" ADD CONSTRAINT "CommitmentInstallment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "CommitmentMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommitmentInstallment" ADD CONSTRAINT "CommitmentInstallment_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
