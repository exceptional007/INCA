import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';

export interface ExtractedHeader {
  institute: string;
  department: string;
  effectiveFrom: string;
  semester: string;
  section: string;
  room: string;
}

export interface ExtractedSlot {
  day: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  isMergedSlot: boolean;
  mergedTimeSlotEnd?: string;
  sectionCodes: string[];
  subjectCode: string;
  subjectName: string;
  facultyShortCode: string;
  facultyFullName: string;
  room: string;
  category: 'academic' | 'skill_development' | 'placement' | 'self_learning';
  rawCellText: string;
}

export interface ExtractedGridResponse {
  gridId: string;
  slots: ExtractedSlot[];
}

/**
 * Gemini AI extraction service for timetable PDFs.
 *
 * Supports two extraction modes:
 * 1. **Direct PDF mode** (inspired by AttendEase): Sends the raw PDF buffer
 *    directly to Gemini as inlineData — skips PNG conversion entirely.
 * 2. **Image mode** (original INCA approach): Sends rendered PNG page images
 *    with two-pass extraction (header + grid).
 *
 * Uses the newer @google/genai SDK (from AttendEase) instead of
 * @google/generative-ai.
 */
@Injectable()
export class GeminiExtractionService {
  private readonly logger = new Logger(GeminiExtractionService.name);
  private ai: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.6-flash';

    if (apiKey) {
      this.logger.log(`Initializing Google Gemini AI client (model: ${this.modelName})...`);
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured. AI extraction will be unavailable.');
    }
  }

  /**
   * Check if Gemini AI is available
   */
  isAvailable(): boolean {
    return this.ai !== null;
  }

  /**
   * Direct PDF extraction — sends the raw PDF to Gemini in a single pass.
   * Inspired by AttendEase's approach: no PNG conversion needed.
   * Extracts both header metadata and all grid slots in one API call.
   */
  async extractFromPdf(
    pdfBuffer: Buffer,
    rawTextContext: string,
  ): Promise<{ header: ExtractedHeader; grid: ExtractedGridResponse }> {
    if (!this.ai) {
      throw new Error('Gemini AI client is not configured. Set GEMINI_API_KEY.');
    }

    this.logger.log('Starting direct PDF→Gemini extraction...');

    const promptText = `You are an expert academic timetable parser. Analyze the attached timetable PDF document and extract ALL details into structured JSON.

The PDF contains a college/university weekly timetable with:
- A header section with institute name, department, semester, section, room number, and effective date
- A grid/table showing class schedules for each day of the week (Monday-Saturday)
- A legend table mapping short codes to full subject names and faculty names

Extract:
1. Header metadata:
   - institute: Name of the institute
   - department: Department code (e.g. CSE-DS, CSE-AIML)
   - effectiveFrom: Date the timetable is effective from
   - semester: Semester (e.g. "7TH")
   - section: Section code (e.g. "C")
   - room: Default room number

2. All class/lecture slots from the grid:
   - day: Weekday (MON, TUES, WED, THU, FRI, SAT)
   - timeSlotStart: Start time (e.g. "9:10 AM")
   - timeSlotEnd: End time (e.g. "10:05 AM")
   - isMergedSlot: true if the cell spans multiple time columns (e.g. lab sessions)
   - mergedTimeSlotEnd: If merged, the end time of the combined slot
   - sectionCodes: Array of section/group codes (e.g. ["C1", "C2"] or ["C"])
   - subjectCode: Official Subject Code (e.g. "BAI 701", "KCS-701", "TECHEDGE", "DL LAB"). Always check the legend table at the bottom of the sheet to map short cell codes (e.g. "DL", "DEE", "PLA", "TEC") to their official subject code! If no separate code is in the legend, use the short code from the cell.
   - subjectName: Full subject name from legend or cell (e.g. "DEEP LEARNING")
   - facultyShortCode: Short initials (e.g. "RS")
   - facultyFullName: Full faculty name from legend (e.g. "MR RANJEET SINGH")
   - room: Classroom or Lab code
   - category: One of "academic", "skill_development", "placement", "self_learning" (based on cell color/context: Yellow=academic, Green=skill_development, Pink=placement, Blue=self_learning)
   - rawCellText: The literal text from the cell

Do NOT include SHORT BREAK or LUNCH BREAK slots.
CRITICAL INSTRUCTION FOR MULTI-PERIOD / LAB / TECHEDGE SESSIONS: If a lab or lecture session spans two consecutive time slots (e.g. 2:40 PM to 4:30 PM, or a 2-hour lab / Techedge practical), extract EACH 1-hour time slot as an INDIVIDUAL slot item in the JSON list (e.g. Item 1: 2:40 PM - 3:35 PM, Item 2: 3:35 PM - 4:30 PM) so that every single lecture period has its own separate slot object.
Use the legend table at the bottom to resolve short codes to full names and subject codes.

Supporting raw text from PDF parser:
${rawTextContext}`;

    const parts: any[] = [
      {
        inlineData: {
          data: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      },
      { text: promptText },
    ];

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            header: {
              type: Type.OBJECT,
              properties: {
                institute: { type: Type.STRING },
                department: { type: Type.STRING },
                effectiveFrom: { type: Type.STRING },
                semester: { type: Type.STRING },
                section: { type: Type.STRING },
                room: { type: Type.STRING },
              },
              required: ['institute', 'department', 'effectiveFrom', 'semester', 'section', 'room'],
            },
            slots: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  timeSlotStart: { type: Type.STRING },
                  timeSlotEnd: { type: Type.STRING },
                  isMergedSlot: { type: Type.BOOLEAN },
                  mergedTimeSlotEnd: { type: Type.STRING },
                  sectionCodes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  subjectCode: { type: Type.STRING },
                  subjectName: { type: Type.STRING },
                  facultyShortCode: { type: Type.STRING },
                  facultyFullName: { type: Type.STRING },
                  room: { type: Type.STRING },
                  category: { type: Type.STRING },
                  rawCellText: { type: Type.STRING },
                },
                required: [
                  'day', 'timeSlotStart', 'timeSlotEnd', 'isMergedSlot',
                  'sectionCodes', 'subjectCode', 'subjectName',
                  'facultyShortCode', 'facultyFullName', 'room',
                  'category', 'rawCellText',
                ],
              },
            },
          },
          required: ['header', 'slots'],
        },
      },
    });

    const responseText = response.text || '';
    this.logger.log(`Direct PDF extraction response length: ${responseText.length}`);

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      this.logger.error('Failed to parse Gemini JSON response for direct PDF extraction');
      throw new Error(`Gemini returned invalid JSON: ${responseText.substring(0, 200)}`);
    }

    // Validate minimum fields
    if (!parsed.header || !parsed.slots || !Array.isArray(parsed.slots)) {
      throw new Error('Gemini response missing required header or slots data');
    }

    if (parsed.slots.length === 0) {
      this.logger.warn('Gemini returned zero slots from direct PDF extraction');
    }

    const header: ExtractedHeader = {
      institute: parsed.header.institute || '',
      department: parsed.header.department || '',
      effectiveFrom: parsed.header.effectiveFrom || '',
      semester: parsed.header.semester || '',
      section: parsed.header.section || '',
      room: parsed.header.room || '',
    };

    const grid: ExtractedGridResponse = {
      gridId: `${header.department}-${header.section}`,
      slots: (parsed.slots as any[]).map((slot) => ({
        day: (slot.day || '').toUpperCase().trim(),
        timeSlotStart: slot.timeSlotStart || '',
        timeSlotEnd: slot.timeSlotEnd || '',
        isMergedSlot: slot.isMergedSlot || false,
        mergedTimeSlotEnd: slot.mergedTimeSlotEnd,
        sectionCodes: Array.isArray(slot.sectionCodes) ? slot.sectionCodes : [header.section],
        subjectCode: slot.subjectCode || '',
        subjectName: slot.subjectName || '',
        facultyShortCode: slot.facultyShortCode || '',
        facultyFullName: slot.facultyFullName || '',
        room: slot.room || header.room,
        category: this.normalizeCategory(slot.category),
        rawCellText: slot.rawCellText || '',
      })),
    };

    this.logger.log(`Direct PDF extraction complete: ${grid.slots.length} slots extracted`);
    return { header, grid };
  }

  /**
   * Image-based header extraction (original INCA approach, kept as fallback)
   */
  async extractHeader(
    pageImageBuffer: Buffer,
    rawTextContext: string,
  ): Promise<ExtractedHeader> {
    if (!this.ai) {
      throw new Error('Gemini AI client is not configured. Set GEMINI_API_KEY.');
    }

    const prompt = `Analyze this college timetable page image and raw text content.
    Extract the header block metadata at the top:
    - Institute Name (e.g. BUDDHA INSTITUTE OF TECHNOLOGY)
    - Department Name / Code (e.g. CSE-DS or CSE-AIML)
    - "week effective from" (w.e.f.) date (e.g. 13 July, 2026)
    - Semester (e.g. 7TH)
    - Section (e.g. C or D)
    - Room No. (e.g. 416 or 418)

    Supporting Raw Text:
    ${rawTextContext}`;

    const parts: any[] = [
      {
        inlineData: {
          data: pageImageBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      },
      { text: prompt },
    ];

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            institute: { type: Type.STRING, description: 'Name of the institute' },
            department: { type: Type.STRING, description: 'Department code, e.g. CSE-DS' },
            effectiveFrom: { type: Type.STRING, description: 'Date the timetable is effective from' },
            semester: { type: Type.STRING, description: 'Semester, e.g., 7TH' },
            section: { type: Type.STRING, description: 'Section code, e.g., C' },
            room: { type: Type.STRING, description: 'Room number, e.g., 416' },
          },
          required: ['institute', 'department', 'effectiveFrom', 'semester', 'section', 'room'],
        },
      },
    });

    const responseText = response.text || '';
    this.logger.log(`Gemini Header Extraction response: ${responseText}`);
    return JSON.parse(responseText) as ExtractedHeader;
  }

  /**
   * Image-based grid extraction (original INCA approach, kept as fallback)
   */
  async extractGrid(
    pageImageBuffer: Buffer,
    rawTextContext: string,
    header: ExtractedHeader,
  ): Promise<ExtractedGridResponse> {
    if (!this.ai) {
      throw new Error('Gemini AI client is not configured. Set GEMINI_API_KEY.');
    }

    const prompt = `You are given a college timetable page image and raw text content.
    We have already extracted the header metadata for this grid:
    ${JSON.stringify(header)}

    Please extract:
    1. Every weekday class/activity cell from the main weekly timetable grid. 
       - Weekdays (rows) are Mon-Sat.
       - Schedulable time slot columns are: 9:10-10:05 AM, 10:05-11:00 AM, 11:15-12:10 PM, 12:10-01:05 PM, 01:45-02:40 PM, 2:40-3:35 PM, 3:35-4:30 PM.
       - Do NOT extract slots for 'SHORT BREAK' or 'LUNCH BREAK' columns.
    2. Handle merged cells spanning multiple periods (e.g., 'PROJECT LAB-(C1+C2)-KJ-L-202' spanning two slots). Set isMergedSlot=true and set the mergedTimeSlotEnd.
    3. Determine the category based on cell color:
       - Academic/Core (Yellow/Gold color) -> 'academic'
       - Skill Development / Lab / Classes (Green color) -> 'skill_development'
       - Placement (Pink/Rose color) -> 'placement'
       - Self Learning (Blue/Gray color) -> 'self_learning'
    4. At the bottom of the page, there is a legend table mapping short codes to full subject codes, names, and faculty names.
       Use this legend to resolve the Subject Code (e.g. BAI 701), Full Subject Name, and Full Faculty Name (e.g. MR RANJEET SINGH) for each grid slot.

    Supporting Raw Text:
    ${rawTextContext}`;

    const parts: any[] = [
      {
        inlineData: {
          data: pageImageBuffer.toString('base64'),
          mimeType: 'image/png',
        },
      },
      { text: prompt },
    ];

    const slotSchema = {
      type: Type.OBJECT,
      properties: {
        day: { type: Type.STRING },
        timeSlotStart: { type: Type.STRING },
        timeSlotEnd: { type: Type.STRING },
        isMergedSlot: { type: Type.BOOLEAN },
        mergedTimeSlotEnd: { type: Type.STRING },
        sectionCodes: { type: Type.ARRAY, items: { type: Type.STRING } },
        subjectCode: { type: Type.STRING },
        subjectName: { type: Type.STRING },
        facultyShortCode: { type: Type.STRING },
        facultyFullName: { type: Type.STRING },
        room: { type: Type.STRING },
        category: { type: Type.STRING },
        rawCellText: { type: Type.STRING },
      },
      required: [
        'day', 'timeSlotStart', 'timeSlotEnd', 'isMergedSlot',
        'sectionCodes', 'subjectCode', 'subjectName',
        'facultyShortCode', 'facultyFullName', 'room',
        'category', 'rawCellText',
      ],
    };

    const response = await this.ai.models.generateContent({
      model: this.modelName,
      contents: { parts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            gridId: { type: Type.STRING },
            slots: { type: Type.ARRAY, items: slotSchema },
          },
          required: ['gridId', 'slots'],
        },
      },
    });

    const responseText = response.text || '';
    this.logger.log(`Gemini Grid slots response length: ${responseText.length}`);
    return JSON.parse(responseText) as ExtractedGridResponse;
  }

  /**
   * Normalize category string to one of the valid enum values
   */
  private normalizeCategory(category: string): ExtractedSlot['category'] {
    const lower = (category || '').toLowerCase().trim();
    if (lower.includes('skill') || lower.includes('development')) return 'skill_development';
    if (lower.includes('placement') || lower.includes('career')) return 'placement';
    if (lower.includes('self') || lower.includes('learning') || lower.includes('library')) return 'self_learning';
    return 'academic';
  }
}
