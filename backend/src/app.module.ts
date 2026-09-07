import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AcademicModule } from './modules/academic/academic.module';
import { StudentModule } from "./modules/student/student.module";
import { FacultyModule } from './modules/faculty/faculty.module';
import { SchedulingModule } from './modules/scheduling/scheduling.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SuperAdminModule } from './modules/super-admin/super-admin.module';
import { StorageModule } from './modules/storage/storage.module';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    StorageModule,
    AuthModule,
    AcademicModule,
    StudentModule,
    FacultyModule,
    SchedulingModule,
    ActivitiesModule,
    AttendanceModule,
    ReportsModule,
    RequestsModule,
    SuperAdminModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*');
  }
}