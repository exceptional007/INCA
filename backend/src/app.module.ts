import {Module} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AcademicModule } from './modules/academic/academic.module';
import { StudentModule } from "./modules/student/student.module";
import { FacultyModule } from './modules/faculty/faculty.module';

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
    FacultyModule
  ],
})
export class AppModule {}