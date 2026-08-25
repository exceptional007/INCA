import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface MatchResult {
  matchedId: string | null;
  confidence: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getLevenshteinDistance(a: string, b: string): number {
    const tmp: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
      tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
      tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        tmp[i][j] = Math.min(
          tmp[i - 1][j] + 1,
          tmp[i][j - 1] + 1,
          tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
        );
      }
    }
    return tmp[a.length][b.length];
  }

  private cleanString(str: string): string {
    return str
      .toLowerCase()
      .replace(/^(mr|mrs|ms|dr|prof)\.?\s+/i, '') // remove prefix titles
      .replace(/[^a-z0-9]/g, '') // remove special chars/spaces
      .trim();
  }

  calculateSimilarity(s1: string, s2: string): number {
    const norm1 = this.cleanString(s1);
    const norm2 = this.cleanString(s2);
    if (norm1 === norm2) return 1.0;
    if (!norm1 || !norm2) return 0.0;
    const distance = this.getLevenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    return (maxLength - distance) / maxLength;
  }

  async matchSubject(code: string, name: string): Promise<MatchResult> {
    const cleanCode = code.trim().toUpperCase();
    
    // 1. Exact match on code
    const exactCode = await this.prisma.subject.findUnique({
      where: { code: cleanCode },
    });
    if (exactCode) return { matchedId: exactCode.id, confidence: 1.0 };

    // 2. Query all subjects to perform fuzzy matching
    const subjects = await this.prisma.subject.findMany();
    let bestMatch: { id: string; confidence: number } | null = null;

    for (const sub of subjects) {
      const codeSimilarity = this.calculateSimilarity(code, sub.code);
      const nameSimilarity = this.calculateSimilarity(name, sub.name);
      const score = Math.max(codeSimilarity, nameSimilarity);

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { id: sub.id, confidence: score };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        matchedId: bestMatch.confidence >= 0.85 ? bestMatch.id : null, // mid-range flags are not auto-linked
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: 0.0 };
  }

  async matchFaculty(fullName: string, shortCode: string): Promise<MatchResult> {
    // 1. Exact match on employeeCode = shortCode
    const exactCode = await this.prisma.faculty.findUnique({
      where: { employeeCode: shortCode.trim().toUpperCase() },
    });
    if (exactCode) return { matchedId: exactCode.id, confidence: 1.0 };

    // 2. Query all faculty
    const faculties = await this.prisma.faculty.findMany();
    let bestMatch: { id: string; confidence: number } | null = null;

    const queryName = fullName.trim();
    for (const fac of faculties) {
      const facFullName = `${fac.firstName} ${fac.lastName || ''}`.trim();
      const nameSimilarity = this.calculateSimilarity(queryName, facFullName);
      const codeSimilarity = this.calculateSimilarity(shortCode, fac.employeeCode);
      const score = Math.max(nameSimilarity, codeSimilarity);

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { id: fac.id, confidence: score };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        matchedId: bestMatch.confidence >= 0.85 ? bestMatch.id : null,
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: 0.0 };
  }

  async matchRoom(roomCode: string): Promise<MatchResult> {
    const cleanCode = roomCode.trim().toUpperCase();
    
    // 1. Exact match on code
    const exactCode = await this.prisma.room.findUnique({
      where: { code: cleanCode },
    });
    if (exactCode) return { matchedId: exactCode.id, confidence: 1.0 };

    // 2. Query all rooms
    const rooms = await this.prisma.room.findMany();
    let bestMatch: { id: string; confidence: number } | null = null;

    for (const room of rooms) {
      const similarity = this.calculateSimilarity(roomCode, room.code);
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = { id: room.id, confidence: similarity };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        matchedId: bestMatch.confidence >= 0.85 ? bestMatch.id : null,
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: 0.0 };
  }

  async matchSection(sectionCode: string, semesterNum?: number, deptCode?: string): Promise<MatchResult> {
    const cleanCode = sectionCode.trim().toUpperCase();

    // 1. Attempt narrow database lookup including semester and department code if available
    if (semesterNum !== undefined) {
      const matched = await this.prisma.section.findFirst({
        where: {
          name: cleanCode,
          semester: {
            number: semesterNum,
          },
          batch: deptCode
            ? {
                program: {
                  department: {
                    code: {
                      contains: deptCode,
                      mode: 'insensitive',
                    },
                  },
                },
              }
            : undefined,
        },
      });
      if (matched) {
        return { matchedId: matched.id, confidence: 1.0 };
      }
    }

    // 2. Exact match by name
    const exact = await this.prisma.section.findFirst({
      where: { name: cleanCode },
    });
    if (exact) return { matchedId: exact.id, confidence: 0.9 };

    // 3. Query all sections for fuzzy match
    const sections = await this.prisma.section.findMany({
      include: { semester: true },
    });
    let bestMatch: { id: string; confidence: number } | null = null;

    for (const sec of sections) {
      const similarity = this.calculateSimilarity(sectionCode, sec.name);
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = { id: sec.id, confidence: similarity };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.5) {
      return {
        matchedId: bestMatch.confidence >= 0.85 ? bestMatch.id : null,
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: 0.0 };
  }
}
