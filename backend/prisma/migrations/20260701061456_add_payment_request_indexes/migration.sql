-- CreateIndex
CREATE INDEX "payment_requests_senderId_status_createdAt_idx" ON "payment_requests"("senderId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "payment_requests_receiverId_status_createdAt_idx" ON "payment_requests"("receiverId", "status", "createdAt");
