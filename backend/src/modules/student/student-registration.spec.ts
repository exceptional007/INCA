import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { Readable } from 'node:stream';
import { StudentController } from './student.controller';
import { StudentService } from './student.service';
import { StudentRepository } from './repositories/student.repository';
import { StudentRegistrationService } from './student-registration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StrictR2StorageService } from '../storage/strict-r2-storage.service';
import { NoticesService } from '../notices/notices.service';

describe('Student registration with photo (isolated HTTP integration)', () => {
  const departmentId = '10000000-0000-4000-8000-000000000001';
  const sectionId = '20000000-0000-4000-8000-000000000001';
  const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j3ioAAAAASUVORK5CYII=', 'base64');
  const dto = { email: 'newstudent@bit.ac.in', password: 'InitialPassword123', firstName: 'New', lastName: 'Student', gender: 'OTHER', collegeId: 'BIT-2026-001', rollNumber: 'BIT26DS001', enrollmentNumber: 'UNIVERSITY-2026-001', departmentId, sectionId, dateOfBirth: '2005-03-20', phone: '9876543210', bloodGroup: 'O_POSITIVE', emergencyContactName: 'Guardian', emergencyContactPhone: '9876543211', address: 'Test campus address' };
  let app: any, db: any, storage: any, state: any, failStudent: boolean;
  beforeEach(async () => {
    state = { users: [], students: [] }; failStudent = false;
    db = {
      user: { findUnique: jest.fn(async ({ where }) => where.id ? { id: where.id, isActive: true, role: { code: where.id, isActive: true }, adminProfile: { departmentId }, faculty: { departmentId } } : state.users.find(u => u.email === where.email) || null) },
      department: { findFirst: jest.fn(async ({ where }) => where.id === departmentId ? { id: departmentId } : null), findMany: jest.fn(async () => [{ id: departmentId, name: 'Computer Science', code: 'CSE' }]) },
      section: { findFirst: jest.fn(async ({ where }) => where.id === sectionId && where.semester.program.departmentId === departmentId ? { id: sectionId } : null), findMany: jest.fn(async () => [{ id: sectionId, name: 'A', semester: { number: 1, program: { name: 'B.Tech', departmentId } } }]) },
      role: { findUnique: jest.fn(async () => ({ id: 'student-role', isActive: true })) },
      $transaction: jest.fn(async callback => {
        const working = structuredClone(state);
        const result = await callback({ user: { create: async ({ data }) => { const row = { ...data, id: 'created-user' }; working.users.push(row); return row; } }, student: { create: async ({ data }) => { if (failStudent) throw new Error('Synthetic persistence failure'); const row = { ...data, id: 'created-student', department: { id: departmentId }, section: { id: sectionId } }; working.students.push(row); return row; } } });
        state = working; return result;
      }),
    };
    const repository = Object.fromEntries(['CollegeId', 'RollNumber', 'EnrollmentNumber'].map(field => [`findBy${field}`, jest.fn(async value => state.students.find(s => s[field[0].toLowerCase() + field.slice(1)] === value) || null)]));
    storage = { uploadStudentPhoto: jest.fn(async () => 'student-photos/new-student.png'), deleteObject: jest.fn(async () => {}), getPublicImageStream: jest.fn(async () => ({ stream: Readable.from(photo), contentType: 'image/png' })) };
    const module = await Test.createTestingModule({ controllers: [StudentController], providers: [StudentService, StudentRegistrationService, { provide: PrismaService, useValue: db }, { provide: StudentRepository, useValue: repository }, { provide: StrictR2StorageService, useValue: storage }, { provide: NoticesService, useValue: {} }] }).overrideGuard(AuthGuard('jwt')).useValue({ canActivate(context) { const req = context.switchToHttp().getRequest(); const role = req.headers['x-test-role'] || 'ADMIN'; req.user = { id: role, role: { code: role } }; return true; } }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useLogger(false); await app.init();
  });
  afterEach(async () => app?.close());
  function create(fields: Record<string, any> = dto, role = 'ADMIN', image: Buffer | null = photo, contentType = 'image/png') {
    let req = request(app.getHttpServer()).post('/students/accounts').set('x-test-role', role);
    for (const [key, value] of Object.entries(fields)) req = req.field(key, String(value));
    return image ? req.attach('photo', image, { filename: 'student.png', contentType }) : req;
  }
  it.each(['ADMIN', 'HOD', 'SUPER_ADMIN'])('saves complete student details, account, and uploaded image for %s', async role => {
    const result = await create(dto, role).expect(201);
    expect(result.body.data.student).toMatchObject({ enrollmentNumber: dto.enrollmentNumber, sectionId, departmentId, phone: dto.phone, photoKey: 'student-photos/new-student.png', bloodGroup: 'O_POSITIVE', emergencyContactName: 'Guardian' });
    expect(state.students).toHaveLength(1); expect(state.users).toHaveLength(1);
    expect(await bcrypt.compare(dto.password, state.users[0].password)).toBe(true);
    expect(state.users[0].mustChangePassword).toBe(true);
    expect(JSON.stringify(result.body)).not.toContain(state.users[0].password);
    expect(storage.uploadStudentPhoto).toHaveBeenCalledWith(photo, 'photo.png', 'image/png');
    const image = await request(app.getHttpServer()).get('/students/photo/stream').query({ key: result.body.data.student.photoKey }).expect(200).expect('Content-Type', /image\/png/);
    expect(image.body).toEqual(photo);
  });
  it('accepts no photo and stores the provided actual enrollment number', async () => {
    const { sectionId: unusedSection, ...unassigned } = dto;
    await create(unassigned, 'ADMIN', null).expect(201);
    expect(storage.uploadStudentPhoto).not.toHaveBeenCalled();
    expect(db.section.findFirst).not.toHaveBeenCalled();
    expect(state.students[0].sectionId).toBeUndefined();
    expect(state.students[0].enrollmentNumber).toBe(dto.enrollmentNumber);
  });
  it('blocks foreign department and section before uploading', async () => {
    await create({ ...dto, departmentId: '10000000-0000-4000-8000-000000000099' }, 'HOD').expect(403);
    await create({ ...dto, sectionId: '20000000-0000-4000-8000-000000000099' }).expect(400);
    expect(storage.uploadStudentPhoto).not.toHaveBeenCalled(); expect(state.students).toHaveLength(0);
  });
  it.each(['STUDENT', 'FACULTY', 'COORDINATOR'])('denies student creation by %s', async role => {
    await create(dto, role).expect(403); expect(storage.uploadStudentPhoto).not.toHaveBeenCalled();
  });
  it.each([{ enrollmentNumber: '' }, { dateOfBirth: '2026-02-30' }, { email: 'student@example.com' }, { password: 'short' }, { dateOfBirth: '2999-01-01' }])('rejects invalid fields %p without persisting data', async fields => {
    await create({ ...dto, ...fields }).expect(400); expect(state.users).toHaveLength(0); expect(storage.uploadStudentPhoto).not.toHaveBeenCalled();
  });
  it('rejects spoofed and oversized images', async () => {
    await create(dto, 'ADMIN', Buffer.from('<svg/>')).expect(400);
    await create(dto, 'ADMIN', Buffer.alloc(5 * 1024 * 1024 + 1)).expect(413);
    expect(storage.uploadStudentPhoto).not.toHaveBeenCalled();
  });
  it('removes the uploaded object on duplicate email and does not create a second account', async () => {
    await create().expect(201); await create().expect(409);
    expect(state.users).toHaveLength(1); expect(state.students).toHaveLength(1);
    expect(storage.deleteObject).toHaveBeenCalledWith('student-photos/new-student.png');
  });
  it('rolls back the login account and removes the uploaded photo on profile-save failure', async () => {
    failStudent = true; await create().expect(500);
    expect(state.users).toHaveLength(0); expect(state.students).toHaveLength(0);
    expect(storage.deleteObject).toHaveBeenCalledWith('student-photos/new-student.png');
  });
  it('reports a storage failure without persisting an account', async () => {
    storage.uploadStudentPhoto.mockRejectedValue(new Error('Synthetic R2 failure'));
    await create().expect(500); expect(state.users).toHaveLength(0);
  });
  it('returns only assigned-department academic options for HOD', async () => {
    await request(app.getHttpServer()).get('/students/registration-options').set('x-test-role', 'HOD').expect(200);
    expect(db.department.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: departmentId, isActive: true } }));
  });
  it.each(['ADMIN', 'SUPER_ADMIN'])('lets %s choose any active department and matching section', async role => {
    const result = await request(app.getHttpServer()).get('/students/registration-options').set('x-test-role', role).expect(200);
    expect(result.body.departmentLocked).toBe(false);
    expect(db.department.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }));
    expect(db.section.findMany.mock.calls[0][0].where.semester.program.departmentId).toBeUndefined();
    const otherDepartment = '10000000-0000-4000-8000-000000000099';
    db.department.findFirst.mockResolvedValue({ id: otherDepartment });
    db.section.findFirst.mockResolvedValue({ id: sectionId });
    const saved = await create({ ...dto, departmentId: otherDepartment }, role, null).expect(201);
    expect(saved.body.data.student.departmentId).toBe(otherDepartment);
    expect(db.section.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ semester: { isActive: true, program: { isActive: true, departmentId: otherDepartment } } }) }));
  });
});
