-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "isSettled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "expenses_groupId_isSettled_createdAt_idx" ON "expenses"("groupId", "isSettled", "createdAt");

-- Backfill: mark existing expenses as settled where all non-payer shares are already paid
UPDATE "expenses" e
SET "isSettled" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "expense_shares" s
  WHERE s."expenseId" = e."id"
    AND s."userId" != e."paidById"
    AND s."isPaid" = false
);
