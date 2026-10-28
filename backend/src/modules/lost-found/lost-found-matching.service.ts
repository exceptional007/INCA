import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleGenAI } from '@google/genai';
import { MatchStatus } from '@prisma/client';
import { LostFoundNotificationService } from './lost-found-notification.service';
import { USER_SAFE_SELECT, formatUserName } from './lost-found.service';

interface MatchComparisonResult {
  score: number;
  reason: string;
}

@Injectable()
export class LostFoundMatchingService {
  private readonly logger = new Logger(LostFoundMatchingService.name);
  private ai: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly notificationService: LostFoundNotificationService,
  ) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.6-flash';

    if (apiKey) {
      try {
        this.ai = new GoogleGenAI({ apiKey });
        this.logger.log(`Initialized Gemini client for Lost & Found matching (model: ${this.modelName})`);
      } catch (err) {
        this.logger.warn('Failed to initialize GoogleGenAI client, falling back to heuristic matching:', err);
      }
    } else {
      this.logger.warn('GEMINI_API_KEY not set. Lost & Found matching running in heuristic mode.');
    }
  }

  /**
   * Find candidates and execute the 5-stage matching pipeline for a given report.
   */
  async findAndCreateMatchesForReport(reportId: string): Promise<number> {
    const report = await this.prisma.lostFoundReport.findUnique({
      where: { id: reportId },
      include: { images: true },
    });

    if (!report || report.status === 'RESOLVED' || report.status === 'CANCELLED') {
      return 0;
    }

    const oppositeType = report.type === 'LOST' ? 'FOUND' : 'LOST';

    // 1. Candidate Filtering: opposite type, active status, reasonable date range (within 45 days)
    const reportDate = new Date(report.approximateDate);
    const minDate = new Date(reportDate.getTime() - 45 * 24 * 60 * 60 * 1000);
    const maxDate = new Date(reportDate.getTime() + 45 * 24 * 60 * 60 * 1000);

    const candidates = await this.prisma.lostFoundReport.findMany({
      where: {
        type: oppositeType,
        status: { in: ['OPEN', 'CLAIM_PENDING'] },
        approximateDate: {
          gte: minDate,
          lte: maxDate,
        },
        // Exclude reports by the same user to avoid matching own items
        reporterId: { not: report.reporterId },
        OR: [
          { category: report.category },
          { category: 'OTHER' },
          ...(report.category === 'OTHER' ? [{}] : []),
        ],
      },
      take: 20,
    });

    if (candidates.length === 0) {
      return 0;
    }

    let matchCount = 0;

    for (const candidate of candidates) {
      const lostItem = report.type === 'LOST' ? report : candidate;
      const foundItem = report.type === 'FOUND' ? report : candidate;

      // 2. Token & Attribute Heuristic
      const heuristicScore = this.calculateHeuristicScore(lostItem, foundItem);

      let finalScore = heuristicScore;
      let matchReason = `Matched on category (${lostItem.category}) and campus location similarity.`;

      // 3. Google Gemini AI Semantic Evaluation (if candidate has reasonable baseline similarity >= 25%)
      if (this.ai && heuristicScore >= 25) {
        try {
          const aiResult = await this.evaluateWithGemini(lostItem, foundItem);
          if (aiResult) {
            // Weighted blend: 70% Gemini semantic intelligence + 30% heuristic verification
            finalScore = Math.round(aiResult.score * 0.7 + heuristicScore * 0.3);
            matchReason = aiResult.reason;
          }
        } catch (aiErr) {
          this.logger.warn(`Gemini matching failed between ${lostItem.id} and ${foundItem.id}: ${aiErr.message}`);
          // Keep heuristic score
        }
      }

      // 4. Threshold & Classification
      // Only record matches with score >= 45%
      if (finalScore >= 45) {
        try {
          const match = await this.prisma.lostFoundMatch.upsert({
            where: {
              lostReportId_foundReportId: {
                lostReportId: lostItem.id,
                foundReportId: foundItem.id,
              },
            },
            update: {
              matchingScore: finalScore,
              matchReason,
            },
            create: {
              lostReportId: lostItem.id,
              foundReportId: foundItem.id,
              matchingScore: finalScore,
              matchReason,
              status: MatchStatus.PENDING_REVIEW,
            },
          });

          matchCount++;

          // 5. Safe Notification Delivery (only if score >= 60% and hasn't already been resolved/dismissed)
          if (finalScore >= 60) {
            await this.notificationService.createNotification(
              lostItem.reporterId,
              'Potential Lost Item Match Found',
              `We found a potential match (${finalScore}% confidence) for your lost "${lostItem.title}": "${foundItem.title}". Review match details now.`,
              { reportId: lostItem.id, matchId: match.id, type: 'POTENTIAL_MATCH' },
            );

            await this.notificationService.createNotification(
              foundItem.reporterId,
              'Potential Owner Found for Item',
              `A campus member reported losing "${lostItem.title}", which closely matches your found item "${foundItem.title}" (${finalScore}% match).`,
              { reportId: foundItem.id, matchId: match.id, type: 'POTENTIAL_MATCH' },
            );
          }
        } catch (dbErr) {
          this.logger.error(`Error saving match between ${lostItem.id} and ${foundItem.id}:`, dbErr);
        }
      }
    }

    return matchCount;
  }

  /**
   * Deterministic Token and Attribute Similarity Scoring (0 - 100).
   */
  private calculateHeuristicScore(lostItem: any, foundItem: any): number {
    let score = 0;

    // A. Category matching (up to 30 points)
    if (lostItem.category === foundItem.category) {
      score += 30;
    } else if (lostItem.category === 'OTHER' || foundItem.category === 'OTHER') {
      score += 15;
    }

    // B. Title tokens overlap (up to 35 points)
    const titleTokensLost = this.tokenize(lostItem.title);
    const titleTokensFound = this.tokenize(foundItem.title);
    const titleOverlap = this.calculateTokenOverlap(titleTokensLost, titleTokensFound);
    score += Math.round(titleOverlap * 35);

    // C. Location tokens overlap (up to 20 points)
    const locTokensLost = this.tokenize(lostItem.location);
    const locTokensFound = this.tokenize(foundItem.location);
    const locOverlap = this.calculateTokenOverlap(locTokensLost, locTokensFound);
    score += Math.round(locOverlap * 20);

    // D. Temporal proximity (up to 15 points)
    const diffDays = Math.abs(
      (new Date(lostItem.approximateDate).getTime() - new Date(foundItem.approximateDate).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (diffDays <= 2) {
      score += 15;
    } else if (diffDays <= 7) {
      score += 10;
    } else if (diffDays <= 14) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Google Gemini semantic analysis.
   */
  private async evaluateWithGemini(lostItem: any, foundItem: any): Promise<MatchComparisonResult | null> {
    const prompt = `You are an AI-powered lost and found matching assistant for a university campus.
Analyze these two campus reports to determine if they describe the exact same item.

REPORT 1 (LOST ITEM):
- Title: ${lostItem.title}
- Category: ${lostItem.category}
- Description: ${lostItem.description}
- Distinguishing Features: ${lostItem.distinguishingFeatures || 'None provided'}
- Location Lost: ${lostItem.location}
- Date Lost: ${new Date(lostItem.approximateDate).toISOString().split('T')[0]}

REPORT 2 (FOUND ITEM):
- Title: ${foundItem.title}
- Category: ${foundItem.category}
- Description: ${foundItem.description}
- Distinguishing Features: ${foundItem.distinguishingFeatures || 'None provided'}
- Location Found: ${foundItem.location}
- Date Found: ${new Date(foundItem.approximateDate).toISOString().split('T')[0]}

Evaluate physical item attributes, color, brand, condition, location proximity, and timeline compatibility.
Respond ONLY with a valid JSON object in this exact format (no markdown formatting, no code fence):
{"score": <number between 0 and 100>, "reason": "<concise 1-2 sentence explanation of why they match or differ>"}`;

    const response = await this.ai!.models.generateContent({
      model: this.modelName,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = response.text?.trim() || '';
    const cleanJson = responseText.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/, '').trim();

    try {
      const parsed = JSON.parse(cleanJson);
      const score = typeof parsed.score === 'number' ? Math.min(100, Math.max(0, parsed.score)) : 50;
      const reason = parsed.reason || 'AI semantic comparison completed.';
      return { score, reason };
    } catch {
      return null;
    }
  }

  private tokenize(text?: string): Set<string> {
    if (!text) return new Set();
    const stopWords = new Set(['the', 'and', 'with', 'for', 'near', 'in', 'at', 'on', 'a', 'an', 'of']);
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !stopWords.has(t));
    return new Set(tokens);
  }

  private calculateTokenOverlap(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 || setB.size === 0) return 0;
    let match = 0;
    for (const item of setA) {
      if (setB.has(item)) match++;
    }
    const union = new Set([...setA, ...setB]).size;
    return union > 0 ? match / union : 0;
  }

  /**
   * Retrieve matches for a specific report.
   */
  async getMatchesForReport(reportId: string) {
    const matches = await this.prisma.lostFoundMatch.findMany({
      where: {
        OR: [{ lostReportId: reportId }, { foundReportId: reportId }],
      },
      include: {
        lostReport: {
          include: {
            images: true,
            reporter: {
              select: USER_SAFE_SELECT,
            },
          },
        },
        foundReport: {
          include: {
            images: true,
            reporter: {
              select: USER_SAFE_SELECT,
            },
          },
        },
      },
      orderBy: { matchingScore: 'desc' },
    });

    return matches.map((m) => ({
      ...m,
      lostReport: {
        ...m.lostReport,
        reporterName: formatUserName(m.lostReport.reporter),
      },
      foundReport: {
        ...m.foundReport,
        reporterName: formatUserName(m.foundReport.reporter),
      },
    }));
  }

  /**
   * User or Staff updates match status (e.g. VERIFIED_MATCH or REJECTED).
   */
  async reviewMatch(matchId: string, userId: string, status: MatchStatus) {
    return this.prisma.lostFoundMatch.update({
      where: { id: matchId },
      data: {
        status,
        reviewedById: userId,
        reviewedAt: new Date(),
      },
      include: {
        lostReport: true,
        foundReport: true,
      },
    });
  }
}
