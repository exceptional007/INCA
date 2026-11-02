CREATE TYPE "AttendanceObjectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "attendance_objections" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "attendanceSessionId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "originalStatus" "AttendanceStatus",
  "requestedStatus" "AttendanceStatus",
  "status" "AttendanceObjectionStatus" NOT NULL DEFAULT 'PENDING',
  "reviewerId" TEXT,
  "reviewRemark" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attendance_objections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attendance_objections_reason_check" CHECK (char_length(btrim("reason")) BETWEEN 3 AND 2000),
  CONSTRAINT "attendance_objections_remark_check" CHECK ("reviewRemark" IS NULL OR char_length("reviewRemark") <= 2000),
  CONSTRAINT "attendance_objections_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_objections_attendanceSessionId_fkey" FOREIGN KEY ("attendanceSessionId") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "attendance_objections_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "attendance_objections_studentId_createdAt_idx" ON "attendance_objections"("studentId", "createdAt");
CREATE INDEX "attendance_objections_attendanceSessionId_status_idx" ON "attendance_objections"("attendanceSessionId", "status");
CREATE INDEX "attendance_objections_status_createdAt_idx" ON "attendance_objections"("status", "createdAt");
CREATE INDEX "attendance_objections_reviewerId_idx" ON "attendance_objections"("reviewerId");
CREATE UNIQUE INDEX "attendance_objections_one_pending_idx" ON "attendance_objections"("studentId", "attendanceSessionId") WHERE "status" = 'PENDING';
