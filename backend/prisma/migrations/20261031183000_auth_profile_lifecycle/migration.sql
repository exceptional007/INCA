BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
ALTER TABLE "users" ADD COLUMN "displayName" TEXT, ADD COLUMN "profilePhone" TEXT, ADD COLUMN "profilePhotoKey" TEXT, ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "auth_sessions" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "familyId" TEXT NOT NULL, "authVersion" INTEGER NOT NULL DEFAULT 0, "refreshHash" TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");
CREATE INDEX "auth_sessions_familyId_idx" ON "auth_sessions"("familyId");
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE TABLE "password_resets" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE, "passwordHashAtIssue" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "password_resets_userId_idx" ON "password_resets"("userId");
CREATE INDEX "password_resets_expiresAt_idx" ON "password_resets"("expiresAt");
CREATE TABLE "auth_throttles" ("key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL);
CREATE INDEX "auth_throttles_expiresAt_idx" ON "auth_throttles"("expiresAt");
CREATE TABLE "profile_change_requests" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "changes" JSONB NOT NULL, "previous" JSONB NOT NULL, "photoKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  "reason" TEXT, "reviewerId" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "profile_no_self_review" CHECK ("reviewerId" IS NULL OR "reviewerId" <> "userId")
);
CREATE INDEX "profile_change_requests_userId_createdAt_idx" ON "profile_change_requests"("userId","createdAt");
CREATE INDEX "profile_change_requests_status_createdAt_idx" ON "profile_change_requests"("status","createdAt");
CREATE INDEX "profile_change_requests_reviewerId_idx" ON "profile_change_requests"("reviewerId");
-- Prisma cannot express partial uniqueness; retain this guard in future migrations.
CREATE UNIQUE INDEX "profile_one_pending_per_user" ON "profile_change_requests"("userId") WHERE "status" = 'PENDING';
-- Central invalidation covers administrative changes made through any existing service.
CREATE FUNCTION "inca_bump_auth_version"() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW."password" IS DISTINCT FROM OLD."password"
    OR NEW."email" IS DISTINCT FROM OLD."email"
    OR NEW."roleId" IS DISTINCT FROM OLD."roleId"
    OR NEW."isActive" IS DISTINCT FROM OLD."isActive"
    OR NEW."mustChangePassword" IS DISTINCT FROM OLD."mustChangePassword" THEN
    NEW."authVersion" := OLD."authVersion" + 1;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "users_auth_version" BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "inca_bump_auth_version"();
-- These tables are private backend storage, not Supabase Data API resources.
-- The Prisma connection/table owner retains access; no browser-role policies exist.
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "password_resets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "auth_throttles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "profile_change_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "auth_sessions", "password_resets", "auth_throttles", "profile_change_requests" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "auth_sessions", "password_resets", "auth_throttles", "profile_change_requests" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "auth_sessions", "password_resets", "auth_throttles", "profile_change_requests" FROM authenticated;
  END IF;
END;
$$;
COMMIT;
