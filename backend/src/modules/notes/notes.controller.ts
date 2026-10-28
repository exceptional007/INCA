import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NotesService } from './notes.service';
import { TutorService } from './tutor.service';
import { QuizService } from './quiz.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { QueryNotesDto } from './dto/query-notes.dto';
import { AskTutorDto } from './dto/ask-tutor.dto';
import { GenerateQuizDto } from './dto/generate-quiz.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@Controller('notes')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly tutorService: TutorService,
    private readonly quizService: QuizService,
  ) {}

  /**
   * Faculty metadata context (assigned subjects & permitted programs).
   */
  @Get('faculty/context')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  async getFacultyContext(@Req() req: any) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.getFacultyContext(req.user.id, userRole);
  }

  /**
   * Student academic context (enrolled program & semester).
   */
  @Get('student/context')
  async getStudentContext(@Req() req: any) {
    return this.notesService.getStudentContext(req.user.id);
  }

  /**
   * Faculty: List notes created by authenticated faculty with summary metrics.
   */
  @Get('faculty')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  async listFacultyNotes(@Req() req: any, @Query() query: QueryNotesDto) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.listFacultyNotes(req.user.id, userRole, query);
  }

  /**
   * Student / General: Browse published notes library with filters.
   */
  @Get()
  async listPublishedNotes(@Req() req: any, @Query() query: QueryNotesDto) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.listPublishedNotesForStudent(req.user.id, userRole, query);
  }

  /**
   * Retrieve note details by ID.
   */
  @Get(':id')
  async getNoteById(@Req() req: any, @Param('id') noteId: string) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.getNoteById(req.user.id, userRole, noteId);
  }

  /**
   * Faculty: Upload / Create a learning note.
   */
  @Post()
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async createNote(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateNoteDto,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.createNote(req.user.id, userRole, file, dto);
  }

  /**
   * Faculty: Update note metadata or publication status.
   */
  @Patch(':id')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  async updateNote(
    @Req() req: any,
    @Param('id') noteId: string,
    @Body() dto: UpdateNoteDto,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.updateNote(req.user.id, userRole, noteId, dto);
  }

  /**
   * Faculty: Replace document file.
   */
  @Put(':id/file')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  async replaceDocument(
    @Req() req: any,
    @Param('id') noteId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.replaceDocument(req.user.id, userRole, noteId, file);
  }

  /**
   * Faculty: Delete note.
   */
  @Delete(':id')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  async deleteNote(@Req() req: any, @Param('id') noteId: string) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.deleteNote(req.user.id, userRole, noteId);
  }

  /**
   * Faculty: Retry document processing.
   */
  @Post(':id/retry')
  @Roles('FACULTY', 'HOD', 'COORDINATOR', 'ADMIN', 'SUPER_ADMIN')
  async retryProcessing(@Req() req: any, @Param('id') noteId: string) {
    const userRole = req.user?.role?.code || req.user?.role;
    return this.notesService.retryProcessing(req.user.id, userRole, noteId);
  }

  /**
   * Download original document file.
   */
  @Get(':id/download')
  async downloadDocument(
    @Req() req: any,
    @Res() res: any,
    @Param('id') noteId: string,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    const { stream, contentType, originalFilename, fileSize } =
      await this.notesService.streamDocumentForUser(req.user.id, userRole, noteId);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      ...(fileSize ? { 'Content-Length': fileSize.toString() } : {}),
    });

    stream.pipe(res);
  }

  /**
   * In-App Document Preview Stream (inline).
   */
  @Get(':id/preview')
  async previewDocument(
    @Req() req: any,
    @Res() res: any,
    @Param('id') noteId: string,
  ) {
    const userRole = req.user?.role?.code || req.user?.role;
    const { stream, contentType, originalFilename, fileSize } =
      await this.notesService.streamDocumentForUser(req.user.id, userRole, noteId);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(originalFilename)}"`,
      ...(fileSize ? { 'Content-Length': fileSize.toString() } : {}),
    });

    stream.pipe(res);
  }

  // ==========================================
  // AI TUTOR ENDPOINTS
  // ==========================================

  /**
   * Ask AI Tutor a question grounded in the note.
   */
  @Post(':id/tutor/ask')
  async askTutor(
    @Req() req: any,
    @Param('id') noteId: string,
    @Body() dto: AskTutorDto,
  ) {
    // Resolve student ID
    const student = await this.resolveStudent(req.user.id);
    return this.tutorService.askTutor(student.id, noteId, dto);
  }

  /**
   * List conversation sessions for student on this note.
   */
  @Get(':id/tutor/conversations')
  async listTutorConversations(@Req() req: any, @Param('id') noteId: string) {
    const student = await this.resolveStudent(req.user.id);
    return this.tutorService.listConversations(student.id, noteId);
  }

  /**
   * Get full messages for a conversation session.
   */
  @Get(':id/tutor/conversations/:conversationId')
  async getTutorConversation(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
  ) {
    const student = await this.resolveStudent(req.user.id);
    return this.tutorService.getConversation(student.id, conversationId);
  }

  // ==========================================
  // QUIZ ENDPOINTS
  // ==========================================

  /**
   * Generate an interactive quiz grounded in the note.
   */
  @Post(':id/quiz/generate')
  async generateQuiz(
    @Req() req: any,
    @Param('id') noteId: string,
    @Body() dto: GenerateQuizDto,
  ) {
    const student = await this.resolveStudent(req.user.id);
    return this.quizService.generateQuiz(student.id, noteId, dto);
  }

  /**
   * Submit quiz answers and receive score + explanations.
   */
  @Post(':id/quiz/:quizId/submit')
  async submitQuiz(
    @Req() req: any,
    @Param('quizId') quizId: string,
    @Body() dto: SubmitQuizDto,
  ) {
    const student = await this.resolveStudent(req.user.id);
    return this.quizService.submitQuiz(student.id, quizId, dto);
  }

  /**
   * Get student's previous quiz attempts on this note.
   */
  @Get(':id/quiz/history')
  async getQuizHistory(@Req() req: any, @Param('id') noteId: string) {
    const student = await this.resolveStudent(req.user.id);
    return this.quizService.getStudentQuizHistory(student.id, noteId);
  }

  private async resolveStudent(userId: string) {
    const student = await this.notesService['prisma'].student.findUnique({
      where: { userId },
    });

    if (student) return student;

    // Fallback for faculty/admin testing student tutor features
    const anyStudent = await this.notesService['prisma'].student.findFirst();
    if (anyStudent) return anyStudent;

    throw new Error('Student account required for AI tutor and quiz sessions.');
  }
}
