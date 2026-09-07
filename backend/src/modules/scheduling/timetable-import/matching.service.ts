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
      .replace(/^(mr|mrs|ms|dr|prof|er|shri|smt)\.?\s+/gi, '') // remove prefix titles
      .replace(/\s+(sir|mam|madam)$/gi, '') // remove suffix honorifics
      .replace(/[^a-z0-9]/g, '') // remove special chars/spaces
      .trim();
  }

  private extractTokens(str: string): string[] {
    return str
      .toLowerCase()
      .replace(/^(mr|mrs|ms|dr|prof|er|shri|smt)\.?\s+/gi, '')
      .replace(/\s+(sir|mam|madam)$/gi, '')
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length >= 2);
  }

  private normalizeCode(code: string): string {
    return (code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private extractInitials(str: string): string {
    const trimmed = (str || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
    // If the input is already a short uppercase token without spaces (e.g., "RS", "DP", "SVM"), it represents initials
    if (trimmed.length >= 2 && trimmed.length <= 4 && !str.trim().includes(' ')) {
      return trimmed;
    }
    const tokens = this.extractTokens(str);
    if (tokens.length >= 2) {
      return tokens.map((t) => t[0].toUpperCase()).join('');
    }
    return trimmed.length <= 4 ? trimmed : '';
  }

  private extractParenthesesAcronym(str: string): string | null {
    const match = str.match(/\(([^)]+)\)/);
    return match ? match[1].trim().toUpperCase() : null;
  }

  calculateSimilarity(s1: string, s2: string): number {
    const norm1 = this.cleanString(s1);
    const norm2 = this.cleanString(s2);
    if (norm1 === norm2 && norm1.length > 0) return 1.0;
    if (!norm1 || !norm2) return 0.0;
    const distance = this.getLevenshteinDistance(norm1, norm2);
    const maxLength = Math.max(norm1.length, norm2.length);
    return (maxLength - distance) / maxLength;
  }

  async matchSubject(code: string, name: string): Promise<MatchResult> {
    const cleanCode = (code || '').trim().toUpperCase();
    const cleanName = (name || '').trim();
    const normCode = this.normalizeCode(cleanCode);

    // 1. Exact match on database code or normalized code
    if (cleanCode) {
      const exactCode = await this.prisma.subject.findUnique({
        where: { code: cleanCode },
      });
      if (exactCode) return { matchedId: exactCode.id, confidence: 1.0 };
    }

    const subjects = await this.prisma.subject.findMany();
    let bestMatch: { id: string; confidence: number } | null = null;

    const queryTokens = this.extractTokens(`${cleanCode} ${cleanName}`);
    const queryAcronym = this.extractParenthesesAcronym(cleanName) || (cleanCode.length <= 6 ? cleanCode : null);

    for (const sub of subjects) {
      const subNormCode = this.normalizeCode(sub.code);
      const subAcronym = this.extractParenthesesAcronym(sub.name);
      const subTokens = this.extractTokens(`${sub.code} ${sub.name}`);

      let score = 0;

      // Strategy A: Normalized code exact match (e.g. "BAI 701" == "BAI-701" == "BAI701")
      if (normCode && normCode === subNormCode) {
        score = 1.0;
      }
      // Strategy B: Acronym match (e.g. cell has "DL" and subject name is "Deep Learning (DL)")
      else if (
        (queryAcronym && subAcronym && queryAcronym === subAcronym) ||
        (queryAcronym && this.normalizeCode(sub.code) === queryAcronym) ||
        (cleanCode && subAcronym && cleanCode === subAcronym)
      ) {
        score = 0.92;
      }
      // Strategy C: Multi-token keyword overlap (e.g. "Placement Preparation", "Deep Learning Lab")
      else if (queryTokens.length > 0 && subTokens.length > 0) {
        const matchingTokens = queryTokens.filter((qt) =>
          subTokens.some((st) => st === qt || (st.length >= 4 && qt.length >= 4 && (st.includes(qt) || qt.includes(st))))
        );
        const tokenOverlapRatio = matchingTokens.length / Math.min(queryTokens.length, subTokens.length);
        if (matchingTokens.length >= 2 || (matchingTokens.length === 1 && matchingTokens[0].length >= 5)) {
          score = Math.max(score, Math.min(0.95, 0.75 + tokenOverlapRatio * 0.2));
        }
      }

      // Strategy D: Fuzzy Levenshtein similarity on cleaned name and code
      const codeSim = this.calculateSimilarity(cleanCode, sub.code);
      const nameSim = this.calculateSimilarity(cleanName, sub.name);
      const fuzzyScore = Math.max(codeSim, nameSim);
      score = Math.max(score, fuzzyScore);

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { id: sub.id, confidence: score };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.70) {
      return {
        matchedId: bestMatch.id,
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: bestMatch ? bestMatch.confidence : 0.0 };
  }

  async matchFaculty(fullName: string, shortCode: string): Promise<MatchResult> {
    const cleanShort = (shortCode || '').trim().toUpperCase();
    const cleanFull = (fullName || '').trim();
    const normShort = this.normalizeCode(cleanShort);

    // 1. Exact match on employeeCode
    if (cleanShort) {
      const exactCode = await this.prisma.faculty.findUnique({
        where: { employeeCode: cleanShort },
      });
      if (exactCode) return { matchedId: exactCode.id, confidence: 1.0 };
    }

    const faculties = await this.prisma.faculty.findMany();
    let bestMatch: { id: string; confidence: number } | null = null;

    const queryTokens = this.extractTokens(`${cleanShort} ${cleanFull}`);
    const queryInitials = this.extractInitials(cleanFull) || (cleanShort.length <= 4 ? cleanShort : '');

    for (const fac of faculties) {
      const facFullName = `${fac.firstName} ${fac.lastName || ''}`.trim();
      const facInitials = this.extractInitials(facFullName);
      const facTokens = this.extractTokens(facFullName);
      const facNormCode = this.normalizeCode(fac.employeeCode);

      let score = 0;

      // Strategy A: Normalized employeeCode exact match
      if (normShort && normShort === facNormCode) {
        score = 1.0;
      }
      // Strategy B: Exact cleaned full name match
      else if (this.cleanString(cleanFull) === this.cleanString(facFullName)) {
        score = 0.98;
      }
      // Strategy C: Initials match (e.g. "DP" for "Dharamveer Patel", "RS" for "Ranjeet Singh")
      else if (queryInitials && facInitials && queryInitials === facInitials) {
        score = 0.90;
      }
      // Strategy D: Keyword / Token overlap (e.g. "Dharamveer Patel", "Dr. Shashank")
      else if (queryTokens.length > 0 && facTokens.length > 0) {
        const matchingTokens = queryTokens.filter((qt) =>
          facTokens.some((ft) => ft === qt || (ft.length >= 4 && qt.length >= 4 && (ft.includes(qt) || qt.includes(ft))))
        );
        const tokenOverlapRatio = matchingTokens.length / Math.min(queryTokens.length, facTokens.length);
        if (matchingTokens.length >= 2) {
          score = 0.92;
        } else if (matchingTokens.length === 1 && matchingTokens[0].length >= 4) {
          score = Math.max(score, 0.85);
        }
      }

      // Strategy E: Fuzzy Levenshtein similarity
      const nameSim = this.calculateSimilarity(cleanFull, facFullName);
      const codeSim = this.calculateSimilarity(cleanShort, fac.employeeCode);
      const fuzzyScore = Math.max(nameSim, codeSim);
      score = Math.max(score, fuzzyScore);

      if (!bestMatch || score > bestMatch.confidence) {
        bestMatch = { id: fac.id, confidence: score };
      }
    }

    if (bestMatch && bestMatch.confidence >= 0.70) {
      return {
        matchedId: bestMatch.id,
        confidence: bestMatch.confidence,
      };
    }

    return { matchedId: null, confidence: bestMatch ? bestMatch.confidence : 0.0 };
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
            ...(deptCode
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
              : {}),
          },
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
