import {Module} from "@nestjs/common";
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AcademicModule,
    StudentModule,
    FacultyModule,
    SchedulingModule,
    ActivitiesModule,
    AttendanceModule,
    ReportsModule
  ],
})
export class AppModule {}