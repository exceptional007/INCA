-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'EXTRACTED', 'PENDING_REVIEW', 'COMMITTED', 'ROLLED_BACK', 'EXTRACTION_FAILED', 'DISCARDED');

-- CreateTable
CREATE TABLE "timetable_import_batches" (
    "id" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "sourceFileR2Key" TEXT NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "pagesJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "timetable_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slot_drafts" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "gridId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeSlotStart" TEXT NOT NULL,
    "timeSlotEnd" TEXT NOT NULL,
    "isMergedSlot" BOOLEAN NOT NULL DEFAULT false,
    "sectionCodes" TEXT[],
    "subjectRaw" TEXT NOT NULL,
    "facultyRaw" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "matchedSubjectId" TEXT,
    "matchedFacultyId" TEXT,
    "matchedRoomId" TEXT,
    "matchedSectionId" TEXT,
    "matchConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "rawCellText" TEXT NOT NULL,
    "adminEdited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "timetable_slot_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_versions" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timetable_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "timeSlotStart" TEXT NOT NULL,
    "timeSlotEnd" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "timetable_import_batches" ADD CONSTRAINT "timetable_import_batches_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slot_drafts" ADD CONSTRAINT "timetable_slot_drafts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "timetable_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slot_drafts" ADD CONSTRAINT "timetable_slot_drafts_matchedSubjectId_fkey" FOREIGN KEY ("matchedSubjectId") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slot_drafts" ADD CONSTRAINT "timetable_slot_drafts_matchedFacultyId_fkey" FOREIGN KEY ("matchedFacultyId") REFERENCES "faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slot_drafts" ADD CONSTRAINT "timetable_slot_drafts_matchedRoomId_fkey" FOREIGN KEY ("matchedRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slot_drafts" ADD CONSTRAINT "timetable_slot_drafts_matchedSectionId_fkey" FOREIGN KEY ("matchedSectionId") REFERENCES "sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_versions" ADD CONSTRAINT "timetable_versions_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "timetable_import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "timetable_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "faculty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
