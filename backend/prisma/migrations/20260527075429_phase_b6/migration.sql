-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DONATION', 'EXPENSE', 'SYSTEM', 'RECEIPT', 'SECURITY');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "user_id" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLog" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "donation_id" TEXT,
    "expense_id" TEXT,
    "reconciled_by" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_trust_id_module_idx" ON "AuditLog"("trust_id", "module");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- CreateIndex
CREATE INDEX "Notification_trust_id_is_read_idx" ON "Notification"("trust_id", "is_read");

-- CreateIndex
CREATE INDEX "Notification_created_at_idx" ON "Notification"("created_at");

-- CreateIndex
CREATE INDEX "ReconciliationLog_trust_id_idx" ON "ReconciliationLog"("trust_id");

-- CreateIndex
CREATE INDEX "ReconciliationLog_created_at_idx" ON "ReconciliationLog"("created_at");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLog" ADD CONSTRAINT "ReconciliationLog_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "Trust"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLog" ADD CONSTRAINT "ReconciliationLog_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLog" ADD CONSTRAINT "ReconciliationLog_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "Expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLog" ADD CONSTRAINT "ReconciliationLog_reconciled_by_fkey" FOREIGN KEY ("reconciled_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
