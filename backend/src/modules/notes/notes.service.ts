import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { DocumentProcessingService } from './document-processing.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import { NoteSourceType, NoteStatus, Prisma } from '@prisma/client';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: StrictR2StorageService,
    private readonly documentProcessingService: DocumentProcessingService,
  ) {}

  /**
   * Return metadata context for faculty note creation (assigned subjects, permitted programs).
   */
  async getFacultyContext(userId: string, userRole: string) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    let faculty = await this.prisma.faculty.findUnique({
      where: { userId },
      include: { department: true },
    });

    if (!faculty && isGlobalAdmin) {
      // Find or fallback to first faculty for admin test context
      faculty = await this.prisma.faculty.findFirst({
        include: { department: true },
      });
    }

    if (!faculty) {
      throw new ForbiddenException('Faculty profile not found for this account.');
    }

    // Permitted programs: department programs, or all active if admin
    let programs: any[] = [];
    if (isGlobalAdmin) {
      programs = await this.prisma.program.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, shortName: true },
        orderBy: { code: 'asc' },
      });
    } else if (faculty.departmentId) {
      programs = await this.prisma.program.findMany({
        where: { departmentId: faculty.departmentId, isActive: true },
        select: { id: true, code: true, name: true, shortName: true },
        orderBy: { code: 'asc' },
      });
    }

    if (programs.length === 0) {
      // Fallback to all active programs so faculty is never locked out of selection
      programs = await this.prisma.program.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, shortName: true },
        orderBy: { code: 'asc' },
      });
    }

    // Permitted subjects: assigned via schedule templates / timetable slots, or department subjects
    let subjects: any[] = [];
    if (isGlobalAdmin) {
      subjects = await this.prisma.subject.findMany({
        where: { isActive: true },
        select: { id: true, code: true, name: true, semesterId: true },
        orderBy: { name: 'asc' },
      });
    } else {
      // Find assigned subjects
      const assignedTemplates = await this.prisma.scheduleTemplate.findMany({
        where: { facultyId: faculty.id },
        select: { subjectId: true },
      });
      const assignedSlots = await this.prisma.timetableSlot.findMany({
        where: { facultyId: faculty.id },
        select: { subjectId: true },
      });

      const assignedSubjectIds = Array.from(
        new Set([
          ...assignedTemplates.map((t) => t.subjectId),
          ...assignedSlots.map((s) => s.subjectId),
        ]),
      );

      if (assignedSubjectIds.length > 0) {
        subjects = await this.prisma.subject.findMany({
          where: { id: { in: assignedSubjectIds }, isActive: true },
          select: { id: true, code: true, name: true, semesterId: true },
          orderBy: { name: 'asc' },
        });
      }

      // If no schedule templates yet, load subjects from faculty's department programs
      if (subjects.length === 0 && faculty.departmentId) {
        subjects = await this.prisma.subject.findMany({
          where: {
            isActive: true,
            semester: { program: { departmentId: faculty.departmentId } },
          },
          select: { id: true, code: true, name: true, semesterId: true },
          orderBy: { name: 'asc' },
        });
      }

      if (subjects.length === 0) {
        subjects = await this.prisma.subject.findMany({
          where: { isActive: true },
          take: 30,
          select: { id: true, code: true, name: true, semesterId: true },
          orderBy: { name: 'asc' },
        });
      }
    }

    return {
      faculty: {
        id: faculty.id,
        name: `${faculty.firstName} ${faculty.lastName || ''}`.trim(),
        employeeCode: faculty.employeeCode,
        department: faculty.department?.name || 'General',
      },
      programs,
      subjects,
    };
  }

  /**
   * Faculty: Create a new learning note (file upload or Google Drive link).
   */
  async createNote(
    userId: string,
    userRole: string,
    file: Express.Multer.File | undefined,
    dto: CreateNoteDto,
  ) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    let faculty = await this.prisma.faculty.findUnique({ where: { userId } });
    if (!faculty && isGlobalAdmin) {
      faculty = await this.prisma.faculty.findFirst();
    }

    if (!faculty) {
      throw new ForbiddenException('Faculty profile required to upload learning notes.');
    }

    // 1. Validate subject
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject || !subject.isActive) {
      throw new BadRequestException('Selected subject does not exist or is inactive.');
    }

    // 2. Validate programs
    if (!dto.programIds || dto.programIds.length === 0) {
      throw new BadRequestException('At least one academic program must be selected.');
    }

    const validPrograms = await this.prisma.program.findMany({
      where: { id: { in: dto.programIds }, isActive: true },
    });
    if (validPrograms.length !== dto.programIds.length) {
      throw new BadRequestException('One or more selected academic programs are invalid.');
    }

    let storageKey: string | null = null;
    let originalFilename: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;

    const sourceType = dto.sourceType || NoteSourceType.FILE;

    if (sourceType === NoteSourceType.FILE) {
      if (!file) {
        throw new BadRequestException('File is required when source type is FILE.');
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`File size exceeds the 25 MB limit (file size: ${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
      }

      const ext = (file.originalname.split('.').pop() || '').toLowerCase();
      const validExtensions = ['pdf', 'docx'];
      if (!validExtensions.includes(ext)) {
        throw new BadRequestException(`Invalid file type ".${ext}". Only PDF and DOCX files are supported.`);
      }

      // Upload file to Cloudflare R2
      storageKey = await this.r2Storage.uploadLearningMaterial(
        file.buffer,
        file.originalname,
        file.mimetype || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      );
      originalFilename = file.originalname;
      mimeType = file.mimetype;
      fileSize = file.size;
    } else if (sourceType === NoteSourceType.DRIVE) {
      if (!dto.driveUrl || !dto.driveUrl.trim()) {
        throw new BadRequestException('Google Drive sharing URL is required when source type is DRIVE.');
      }

      const isDriveUrl = /drive\.google\.com|docs\.google\.com/i.test(dto.driveUrl);
      if (!isDriveUrl) {
        throw new BadRequestException('Invalid Google Drive URL. Must be a drive.google.com or docs.google.com link.');
      }
    }

    const initialStatus = dto.status === NoteStatus.DRAFT ? NoteStatus.DRAFT : NoteStatus.PROCESSING;

    // Persist note and program associations
    const note = await this.prisma.learningNote.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim(),
        sourceType,
        storageKey,
        originalFilename,
        mimeType,
        fileSize,
        driveUrl: dto.driveUrl?.trim(),
        subjectId: dto.subjectId,
        facultyId: faculty.id,
        semesterNumber: dto.semesterNumber,
        status: initialStatus,
        tags: dto.tags || [],
        programs: {
          create: dto.programIds.map((progId) => ({
            programId: progId,
          })),
        },
      },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        programs: { include: { program: { select: { id: true, code: true, name: true } } } },
      },
    });

    // Start background document processing if not draft
    if (initialStatus !== NoteStatus.DRAFT) {
      this.documentProcessingService.processNoteAsync(note.id).catch((err) => {
        this.logger.error(`Background processing trigger failed for note ${note.id}: ${err?.message}`);
      });
    }

    return note;
  }

  /**
   * Faculty: List notes owned by this faculty with dashboard summary metrics.
   */
  async listFacultyNotes(userId: string, userRole: string, query: QueryNotesDto) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    let faculty = await this.prisma.faculty.findUnique({ where: { userId } });
    if (!faculty && isGlobalAdmin) {
      faculty = await this.prisma.faculty.findFirst();
    }

    if (!faculty) {
      throw new ForbiddenException('Faculty profile required.');
    }

    const where: Prisma.LearningNoteWhereInput = {
      ...(isGlobalAdmin ? {} : { facultyId: faculty.id }),
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.programId) {
      where.programs = { some: { programId: query.programId } };
    }

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { subject: { name: { contains: term, mode: 'insensitive' } } },
        { tags: { has: term } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, query.limit || 12);
    const skip = (page - 1) * limit;

    const [notes, totalCount, statusCounts] = await Promise.all([
      this.prisma.learningNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          programs: { include: { program: { select: { id: true, code: true, name: true, shortName: true } } } },
          _count: { select: { chunks: true, quizzes: true } },
        },
      }),
      this.prisma.learningNote.count({ where }),
      this.prisma.learningNote.groupBy({
        by: ['status'],
        where: isGlobalAdmin ? {} : { facultyId: faculty.id },
        _count: { id: true },
      }),
    ]);

    // Calculate metrics
    const countsMap: Record<string, number> = {};
    statusCounts.forEach((sc) => {
      countsMap[sc.status] = sc._count.id;
    });

    const totalNotes = Object.values(countsMap).reduce((a, b) => a + b, 0);

    return {
      items: notes,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      metrics: {
        totalNotes,
        publishedNotes: countsMap[NoteStatus.PUBLISHED] || 0,
        draftNotes: countsMap[NoteStatus.DRAFT] || 0,
        processingNotes: countsMap[NoteStatus.PROCESSING] || 0,
        failedNotes: countsMap[NoteStatus.FAILED] || 0,
      },
    };
  }

  /**
   * Retrieve note details by ID with access control.
   */
  async getNoteById(userId: string, userRole: string, noteId: string) {
    const note = await this.prisma.learningNote.findUnique({
      where: { id: noteId },
      include: {
        subject: { select: { id: true, code: true, name: true } },
        faculty: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        programs: { include: { program: { select: { id: true, code: true, name: true, shortName: true } } } },
        _count: { select: { chunks: true, quizzes: true, conversations: true } },
      },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    // Access control:
    // If student, note must be PUBLISHED
    if (userRole === 'STUDENT' && note.status !== NoteStatus.PUBLISHED) {
      throw new ForbiddenException('You do not have permission to view unpublished draft notes.');
    }

    return note;
  }

  /**
   * Faculty: Update note metadata or publication status.
   */
  async updateNote(userId: string, userRole: string, noteId: string, dto: UpdateNoteDto) {
    const note = await this.assertNoteOwnership(userId, userRole, noteId);

    const updateData: Prisma.LearningNoteUpdateInput = {};

    if (dto.title !== undefined) updateData.title = dto.title.trim();
    if (dto.description !== undefined) updateData.description = dto.description?.trim();
    if (dto.semesterNumber !== undefined) updateData.semesterNumber = dto.semesterNumber;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.driveUrl !== undefined && note.sourceType === NoteSourceType.DRIVE) {
      updateData.driveUrl = dto.driveUrl.trim();
    }

    if (dto.subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: dto.subjectId } });
      if (!subject || !subject.isActive) {
        throw new BadRequestException('Selected subject is invalid or inactive.');
      }
      updateData.subject = { connect: { id: dto.subjectId } };
    }

    // If publishing a draft or changing status
    if (dto.status) {
      if (dto.status === NoteStatus.PUBLISHED && !note.aiReady && note.sourceType === NoteSourceType.FILE) {
        // Trigger processing if not ready
        this.documentProcessingService.processNoteAsync(note.id).catch((err) => {
          this.logger.error(`Processing trigger on publish failed: ${err?.message}`);
        });
      }
      updateData.status = dto.status;
    }

    // If program IDs updated
    if (dto.programIds && Array.isArray(dto.programIds) && dto.programIds.length > 0) {
      await this.prisma.learningNoteProgram.deleteMany({ where: { noteId } });
      updateData.programs = {
        create: dto.programIds.map((progId) => ({ programId: progId })),
      };
    }

    return this.prisma.learningNote.update({
      where: { id: noteId },
      data: updateData,
      include: {
        subject: true,
        programs: { include: { program: true } },
      },
    });
  }

  /**
   * Faculty: Replace uploaded document file (invalidates previous AI index).
   */
  async replaceDocument(
    userId: string,
    userRole: string,
    noteId: string,
    file: Express.Multer.File,
  ) {
    const note = await this.assertNoteOwnership(userId, userRole, noteId);

    if (!file) {
      throw new BadRequestException('A replacement file must be provided.');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds 25 MB limit.`);
    }

    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      throw new BadRequestException('Only PDF and DOCX files are supported.');
    }

    // Delete old R2 object if exists
    if (note.storageKey) {
      await this.r2Storage.deleteObject(note.storageKey);
    }

    // Upload new file to R2
    const storageKey = await this.r2Storage.uploadLearningMaterial(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Invalidate previous chunks
    await this.prisma.learningNoteChunk.deleteMany({ where: { noteId } });

    // Update note state
    const updated = await this.prisma.learningNote.update({
      where: { id: noteId },
      data: {
        storageKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        documentVersion: note.documentVersion + 1,
        aiReady: false,
        status: NoteStatus.PROCESSING,
        processingError: null,
      },
      include: {
        subject: true,
        programs: { include: { program: true } },
      },
    });

    // Start background re-indexing
    this.documentProcessingService.processNoteAsync(noteId).catch((err) => {
      this.logger.error(`Re-indexing failed for replaced note ${noteId}: ${err?.message}`);
    });

    return updated;
  }

  /**
   * Faculty: Delete note and associated storage.
   */
  async deleteNote(userId: string, userRole: string, noteId: string) {
    const note = await this.assertNoteOwnership(userId, userRole, noteId);

    if (note.storageKey) {
      await this.r2Storage.deleteObject(note.storageKey);
    }

    await this.prisma.learningNote.delete({ where: { id: noteId } });
    return { success: true, message: 'Learning note deleted successfully.' };
  }

  /**
   * Faculty: Retry document processing on a failed note.
   */
  async retryProcessing(userId: string, userRole: string, noteId: string) {
    await this.assertNoteOwnership(userId, userRole, noteId);
    this.documentProcessingService.processNoteAsync(noteId).catch((err) => {
      this.logger.error(`Retry processing failed for note ${noteId}: ${err?.message}`);
    });
    return { success: true, message: 'Document processing restarted.' };
  }

  /**
   * Student: Get academic context (enrolled program, semester, subjects).
   */
  async getStudentContext(userId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      include: {
        section: {
          include: {
            semester: {
              include: { program: true },
            },
          },
        },
        department: {
          include: {
            programs: { where: { isActive: true } },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found.');
    }

    const program = student.section?.semester?.program || student.department?.programs?.[0] || null;
    const semesterNumber = student.section?.semester?.number || null;

    return {
      student: {
        id: student.id,
        name: `${student.firstName} ${student.lastName || ''}`.trim(),
        rollNumber: student.rollNumber,
        department: student.department?.name,
      },
      program: program ? { id: program.id, code: program.code, name: program.name } : null,
      semesterNumber,
    };
  }

  /**
   * Student: List published notes available to the student's academic scope.
   */
  async listPublishedNotesForStudent(userId: string, userRole: string, query: QueryNotesDto) {
    const where: Prisma.LearningNoteWhereInput = {
      status: NoteStatus.PUBLISHED,
    };

    if (userRole === 'STUDENT') {
      const student = await this.prisma.student.findUnique({
        where: { userId },
        include: {
          section: {
            include: { semester: { include: { program: true } } },
          },
          department: {
            include: { programs: { where: { isActive: true } } },
          },
        },
      });

      if (student) {
        const studentProgramId = student.section?.semester?.programId;
        const departmentProgramIds = student.department?.programs?.map((p) => p.id) || [];

        const permittedProgramIds = Array.from(
          new Set(
            studentProgramId
              ? [studentProgramId, ...departmentProgramIds]
              : departmentProgramIds,
          ),
        );

        if (permittedProgramIds.length > 0) {
          where.programs = {
            some: { programId: { in: permittedProgramIds } },
          };
        }
      }
    }

    // Apply explicit query filters if provided
    if (query.subjectId) {
      where.subjectId = query.subjectId;
    }

    if (query.programId) {
      where.programs = { some: { programId: query.programId } };
    }

    if (query.semesterNumber) {
      where.semesterNumber = query.semesterNumber;
    }

    if (query.sourceType) {
      where.sourceType = query.sourceType;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { subject: { name: { contains: term, mode: 'insensitive' } } },
        { faculty: { firstName: { contains: term, mode: 'insensitive' } } },
        { faculty: { lastName: { contains: term, mode: 'insensitive' } } },
        { tags: { has: term } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(50, query.limit || 12);
    const skip = (page - 1) * limit;

    const [items, totalCount] = await Promise.all([
      this.prisma.learningNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
        include: {
          subject: { select: { id: true, code: true, name: true } },
          faculty: { select: { id: true, firstName: true, lastName: true } },
          programs: { include: { program: { select: { id: true, code: true, name: true, shortName: true } } } },
          _count: { select: { chunks: true, quizzes: true } },
        },
      }),
      this.prisma.learningNote.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Stream document file for authorized preview or download.
   */
  async streamDocumentForUser(userId: string, userRole: string, noteId: string) {
    const note = await this.prisma.learningNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    // Role verification
    if (userRole === 'STUDENT' && note.status !== NoteStatus.PUBLISHED) {
      throw new ForbiddenException('Cannot access unpublished notes.');
    }

    if (note.sourceType === NoteSourceType.DRIVE) {
      throw new BadRequestException('This note is an external Google Drive link. Open the link directly.');
    }

    if (!note.storageKey) {
      throw new NotFoundException('No file storage key associated with this note.');
    }

    const { stream, contentType } = await this.r2Storage.getObjectStream(note.storageKey);

    return {
      stream,
      contentType: note.mimeType || contentType,
      originalFilename: note.originalFilename || `${note.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
      fileSize: note.fileSize,
    };
  }

  private async assertNoteOwnership(userId: string, userRole: string, noteId: string) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);

    const note = await this.prisma.learningNote.findUnique({
      where: { id: noteId },
      include: { faculty: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found.');
    }

    if (isGlobalAdmin) {
      return note;
    }

    const faculty = await this.prisma.faculty.findUnique({ where: { userId } });
    if (!faculty || note.facultyId !== faculty.id) {
      throw new ForbiddenException('You do not have permission to modify this note.');
    }

    return note;
  }
}
