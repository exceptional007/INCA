import { Injectable, Logger } from '@nestjs/common';
import { ExtractedHeader, ExtractedSlot, ExtractedGridResponse } from './gemini-extraction.service';

/**
 * Text-based fallback parser for timetable PDFs.
 * Uses regex pattern matching on extracted text when Gemini AI is unavailable.
 * Inspired by AttendEase's fallback concept but produces actual parsed data
 * rather than hardcoded dummy data.
 */
@Injectable()
export class PdfTextParserService {
  private readonly logger = new Logger(PdfTextParserService.name);

  // Common time slot patterns in Indian university timetables
  private readonly TIME_PATTERN = /(\d{1,2}[:.]\d{2}\s*(?:AM|PM|am|pm))/g;
  private readonly TIME_RANGE_PATTERN = /(\d{1,2}[:.]\d{2}\s*(?:AM|PM))\s*[-–to]+\s*(\d{1,2}[:.]\d{2}\s*(?:AM|PM))/gi;

  // Day patterns
  private readonly DAY_NAMES = ['MON', 'MONDAY', 'TUES', 'TUESDAY', 'WED', 'WEDNESDAY', 'THU', 'THURS', 'THURSDAY', 'FRI', 'FRIDAY', 'SAT', 'SATURDAY'];
  private readonly DAY_MAP: Record<string, string> = {
    MON: 'MON', MONDAY: 'MON',
    TUES: 'TUES', TUESDAY: 'TUES',
    WED: 'WED', WEDNESDAY: 'WED',
    THU: 'THU', THURS: 'THU', THURSDAY: 'THU',
    FRI: 'FRI', FRIDAY: 'FRI',
    SAT: 'SAT', SATURDAY: 'SAT',
  };

  /**
   * Extract raw text from a PDF buffer using pdf-parse
   */
  async extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    let parser: any = null;
    try {
      const pdfParseModule = require('pdf-parse');
      const PDFParseClass = pdfParseModule.PDFParse || pdfParseModule.default?.PDFParse || pdfParseModule;
      parser = new PDFParseClass({ data: pdfBuffer });
      const result = await parser.getText();
      return result?.text || '';
    } catch (err) {
      this.logger.error('Failed to extract text from PDF using pdf-parse', err);
      return '';
    } finally {
      if (parser && typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }

  /**
   * Attempt to parse header metadata from timetable text
   */
  extractHeader(rawText: string): ExtractedHeader | null {
    if (!rawText || rawText.trim().length < 20) {
      this.logger.warn('Text too short for header extraction');
      return null;
    }

    const text = rawText.toUpperCase();

    // Institute name — look for common patterns
    let institute = '';
    const institutePatterns = [
      /(?:BUDDHA\s+INSTITUTE\s+OF\s+TECHNOLOGY[^)]*)/i,
      /(?:INSTITUTE\s+OF\s+TECHNOLOGY[^)]*)/i,
      /(?:COLLEGE\s+OF\s+(?:ENGINEERING|TECHNOLOGY)[^)]*)/i,
      /(?:UNIVERSITY[^)]*)/i,
    ];
    for (const pattern of institutePatterns) {
      const match = rawText.match(pattern);
      if (match) {
        institute = match[0].trim();
        break;
      }
    }

    // Department code — CSE-DS, CSE-AIML, CSE, IT, etc.
    let department = '';
    const deptMatch = text.match(/(?:DEPARTMENT|DEPT|BRANCH)[\s:]*([A-Z]{2,}(?:-[A-Z]{2,})?)/i)
      || text.match(/\b(CSE-DS|CSE-AIML|CSE-AI|CSE|IT|ECE|EE|ME|CE|AIML|AI-ML)\b/i);
    if (deptMatch) {
      department = deptMatch[1] || deptMatch[0];
    }

    // Semester — look for semester number
    let semester = '';
    const semMatch = text.match(/(?:SEMESTER|SEM)[\s.:]*(\d+)(?:\s*(?:ST|ND|RD|TH))?/i)
      || text.match(/(\d+)\s*(?:ST|ND|RD|TH)\s*(?:SEMESTER|SEM)/i);
    if (semMatch) {
      const num = parseInt(semMatch[1], 10);
      const suffix = num === 1 ? 'ST' : num === 2 ? 'ND' : num === 3 ? 'RD' : 'TH';
      semester = `${num}${suffix}`;
    }

    // Section
    let section = '';
    const sectionMatch = text.match(/\b(?:SECTION|SEC)\b[\s.:]*([A-Z]\d?)/i);
    if (sectionMatch) {
      section = sectionMatch[1];
    }

    // Room number
    let room = '';
    const roomMatch = text.match(/(?:ROOM\s*(?:NO|NUMBER|#)?[\s.:]*)([\w-]+\d+)/i)
      || text.match(/\b(L-?\d{3}|LH-?\d{3}|\d{3,4})\b/);
    if (roomMatch) {
      room = roomMatch[1] || roomMatch[0];
    }

    // Effective from date
    let effectiveFrom = '';
    const dateMatch = rawText.match(/(?:W\.?E\.?F\.?|EFFECTIVE\s+FROM|FROM)[\s.:]*(\d{1,2}\s+\w+[\s,]*\d{4})/i)
      || rawText.match(/(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)[\s,]*\d{4})/i);
    if (dateMatch) {
      effectiveFrom = dateMatch[1].trim();
    }

    // Must have at least some parseable data
    if (!department && !semester && !section) {
      this.logger.warn('Could not extract meaningful header data from text');
      return null;
    }

    return {
      institute: institute || 'Unknown Institute',
      department: department || 'Unknown',
      effectiveFrom: effectiveFrom || new Date().toLocaleDateString(),
      semester: semester || 'Unknown',
      section: section || 'A',
      room: room || 'Unknown',
    };
  }

  /**
   * Attempt to extract timetable grid/slots from text.
   * This is a best-effort heuristic parser for structured timetable text.
   */
  extractGrid(rawText: string, header: ExtractedHeader): ExtractedGridResponse | null {
    if (!rawText || rawText.trim().length < 50) {
      return null;
    }

    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const slots: ExtractedSlot[] = [];

    // Strategy: walk through lines looking for day markers, then parse subsequent content
    let currentDay: string | null = null;
    // Collect time column headers if found
    const timeSlots = this.extractTimeHeaders(rawText);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();

      // Check if this line starts with a day name
      const dayMatch = this.matchDay(upperLine);
      if (dayMatch) {
        currentDay = dayMatch;

        // Try to parse cells from the remainder of this line and following lines
        const lineContent = upperLine.replace(/^(MON(?:DAY)?|TUES(?:DAY)?|WED(?:NESDAY)?|THU(?:RS(?:DAY)?)?|FRI(?:DAY)?|SAT(?:URDAY)?)\s*/i, '').trim();

        if (lineContent) {
          const daySlots = this.parseDaySlots(lineContent, line, currentDay, timeSlots, header);
          slots.push(...daySlots);
        }
        continue;
      }

      // If we have a current day and the line contains subject-like content
      if (currentDay && this.looksLikeSlotContent(upperLine)) {
        const daySlots = this.parseDaySlots(upperLine, line, currentDay, timeSlots, header);
        slots.push(...daySlots);
      }
    }

    if (slots.length === 0) {
      this.logger.warn('Text parser could not extract any timetable slots');
      return null;
    }

    return {
      gridId: `${header.department}-${header.section}`,
      slots,
    };
  }

  /**
   * Check if a string starts with a recognized day name
   */
  private matchDay(text: string): string | null {
    const upper = text.trim().toUpperCase();
    for (const day of this.DAY_NAMES) {
      if (upper.startsWith(day)) {
        return this.DAY_MAP[day] || day;
      }
    }
    return null;
  }

  /**
   * Try to extract time slot column headers from the full text
   */
  private extractTimeHeaders(text: string): Array<{ start: string; end: string }> {
    const timeSlots: Array<{ start: string; end: string }> = [];
    const matches = [...text.matchAll(this.TIME_RANGE_PATTERN)];
    for (const match of matches) {
      timeSlots.push({ start: match[1].trim(), end: match[2].trim() });
    }
    // Deduplicate
    const seen = new Set<string>();
    return timeSlots.filter(ts => {
      const key = `${ts.start}-${ts.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Heuristic: does this text look like timetable slot content?
   */
  private looksLikeSlotContent(text: string): boolean {
    // Contains subject-code-like patterns (e.g. BAI 701, CS302, AI301)
    if (/\b[A-Z]{2,4}\s*\d{3,4}\b/.test(text)) return true;
    // Contains common keywords
    if (/\b(LAB|LECTURE|TUTORIAL|PROJECT|SKILL|PLACEMENT|SELF\s*LEARNING)\b/i.test(text)) return true;
    // Contains faculty short codes in parentheses
    if (/\([A-Z]{2,4}\)/.test(text)) return true;
    return false;
  }

  /**
   * Parse individual slot entries from a day's text content
   */
  private parseDaySlots(
    upperContent: string,
    originalContent: string,
    day: string,
    timeSlots: Array<{ start: string; end: string }>,
    header: ExtractedHeader,
  ): ExtractedSlot[] {
    const slots: ExtractedSlot[] = [];

    // Split content by common delimiters (tabs, multiple spaces, pipe chars)
    const cells = upperContent.split(/\t|\s{3,}|\|/).map(c => c.trim()).filter(c => c.length > 1);

    for (let idx = 0; idx < cells.length; idx++) {
      const cell = cells[idx];

      // Skip break/lunch cells
      if (/\b(BREAK|LUNCH|RECESS)\b/i.test(cell)) continue;

      // Extract subject code
      const subCodeMatch = cell.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
      const subjectCode = subCodeMatch ? subCodeMatch[1].replace(/\s+/g, ' ') : '';

      // Extract faculty short code (in parentheses)
      const facMatch = cell.match(/\(([A-Z]{2,5})\)/);
      const facultyShortCode = facMatch ? facMatch[1] : '';

      // Extract room (L-311, 416, LH-302, etc.)
      const roomMatch = cell.match(/\b(L-?\d{3}|LH-?\d{3}|\d{3,4})\b/);
      const room = roomMatch ? roomMatch[1] : header.room;

      // Determine time slot
      const timeSlot = timeSlots[idx] || {
        start: `${9 + idx}:00 AM`,
        end: `${10 + idx}:00 AM`,
      };

      // Determine category from keywords
      let category: ExtractedSlot['category'] = 'academic';
      if (/\b(SKILL|DEVELOPMENT)\b/i.test(cell)) category = 'skill_development';
      else if (/\b(PLACEMENT|CAREER)\b/i.test(cell)) category = 'placement';
      else if (/\b(SELF\s*LEARNING|LIBRARY)\b/i.test(cell)) category = 'self_learning';

      // Check for lab (merged slots)
      const isLab = /\bLAB\b/i.test(cell);

      // Extract section codes
      const sectionMatch = cell.match(/\(([A-Z]\d(?:\s*\+\s*[A-Z]\d)*)\)/);
      const sectionCodes = sectionMatch
        ? sectionMatch[1].split(/\s*\+\s*/)
        : [header.section];

      if (subjectCode || facultyShortCode || (cell.length > 3 && !/^\d+$/.test(cell))) {
        slots.push({
          day,
          timeSlotStart: timeSlot.start,
          timeSlotEnd: timeSlot.end,
          isMergedSlot: isLab,
          sectionCodes,
          subjectCode: subjectCode || cell.substring(0, 10),
          subjectName: subjectCode || cell,
          facultyShortCode: facultyShortCode || '',
          facultyFullName: '',
          room,
          category,
          rawCellText: cell,
        });
      }
    }

    return slots;
  }
}
