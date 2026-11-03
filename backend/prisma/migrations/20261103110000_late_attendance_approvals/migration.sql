CREATE TYPE "LateAttendanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TABLE "late_attendance_requests" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "scheduleId" TEXT NOT NULL REFERENCES "schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requesterId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reason" TEXT NOT NULL CHECK (char_length(btrim("reason")) BETWEEN 3 AND 2000),
  "scheduleRevision" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" "LateAttendanceStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "reviewRemark" TEXT CHECK ("reviewRemark" IS NULL OR char_length("reviewRemark") <= 2000),
  "reviewedAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3), "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "late_attendance_requests_requesterId_status_createdAt_idx" ON "late_attendance_requests"("requesterId", "status", "createdAt");
CREATE INDEX "late_attendance_requests_scheduleId_requesterId_idx" ON "late_attendance_requests"("scheduleId", "requesterId");
CREATE INDEX "late_attendance_requests_status_createdAt_idx" ON "late_attendance_requests"("status", "createdAt");
CREATE INDEX "late_attendance_requests_reviewerId_idx" ON "late_attendance_requests"("reviewerId");
CREATE UNIQUE INDEX "late_attendance_requests_one_pending_idx" ON "late_attendance_requests"("scheduleId", "requesterId") WHERE "status" = 'PENDING';
CREATE TABLE "late_attendance_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "late_attendance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "late_attendance_events_requestId_createdAt_idx" ON "late_attendance_events"("requestId", "createdAt");
CREATE INDEX "late_attendance_events_actorId_idx" ON "late_attendance_events"("actorId");
