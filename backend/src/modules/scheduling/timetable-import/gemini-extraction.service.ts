import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

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

@Injectable()
export class GeminiExtractionService {
  private readonly logger = new Logger(GeminiExtractionService.name);
  private genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (apiKey) {
      this.logger.log('Initializing Google Gemini Generative AI client...');
      this.genAI = new GoogleGenerativeAI(apiKey);
    } else {
      this.logger.warn('GEMINI_API_KEY is not configured. AI extraction will run in mock mode.');
    }
  }

  private bufferToGenerativePart(buffer: Buffer, mimeType: string) {
    return {
      inlineData: {
        data: buffer.toString('base64'),
        mimeType,
      },
    };
  }

  async extractHeader(
    pageImageBuffer: Buffer,
    rawTextContext: string,
  ): Promise<ExtractedHeader> {
    if (!this.genAI) {
      this.logger.warn('Running mock header extraction...');
      return this.getMockHeader(rawTextContext);
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            institute: { type: SchemaType.STRING, description: 'Name of the institute' },
            department: { type: SchemaType.STRING, description: 'Department code, e.g. CSE-DS' },
            effectiveFrom: { type: SchemaType.STRING, description: 'Date the timetable is effective from, e.g., 13 July, 2026' },
            semester: { type: SchemaType.STRING, description: 'Semester, e.g., 7TH' },
            section: { type: SchemaType.STRING, description: 'Section code, e.g., C' },
            room: { type: SchemaType.STRING, description: 'Room number, e.g., 416' },
          },
          required: ['institute', 'department', 'effectiveFrom', 'semester', 'section', 'room'],
        },
      },
    });

    const imagePart = this.bufferToGenerativePart(pageImageBuffer, 'image/png');
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

    const result = await model.generateContent([imagePart, prompt]);
    const responseText = result.response.text();
    this.logger.log(`Gemini Header Extraction response: ${responseText}`);
    return JSON.parse(responseText) as ExtractedHeader;
  }

  async extractGrid(
    pageImageBuffer: Buffer,
    rawTextContext: string,
    header: ExtractedHeader,
  ): Promise<ExtractedGridResponse> {
    if (!this.genAI) {
      this.logger.warn('Running mock grid extraction...');
      return this.getMockGrid(header);
    }

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            gridId: { type: SchemaType.STRING, description: 'Unique identifier for this grid, e.g. Dept-Section' },
            slots: {
              type: SchemaType.ARRAY,
              description: 'List of all classes/lecture slots extracted from the timetable grid',
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  day: { type: SchemaType.STRING, description: 'Weekday, e.g. MON, TUES, WED, THU, FRI, SAT' },
                  timeSlotStart: { type: SchemaType.STRING, description: 'Start time of slot, e.g. 9:10 AM or 10:05 AM' },
                  timeSlotEnd: { type: SchemaType.STRING, description: 'End time of slot, e.g. 10:05 AM or 11:00 AM' },
                  isMergedSlot: { type: SchemaType.BOOLEAN, description: 'True if cell spans multiple columns' },
                  mergedTimeSlotEnd: { type: SchemaType.STRING, description: 'If merged, end time of the combined slot' },
                  sectionCodes: {
                    type: SchemaType.ARRAY,
                    items: { type: SchemaType.STRING },
                    description: 'Sections/groups attending the slot, e.g. ["C1", "C2"] or ["D1", "D2"] or just ["C"]'
                  },
                  subjectCode: { type: SchemaType.STRING, description: 'Subject code matching the legend, e.g. BAI 701' },
                  subjectName: { type: SchemaType.STRING, description: 'Full subject name from legend, e.g. DEEP LEARNING (DL)' },
                  facultyShortCode: { type: SchemaType.STRING, description: 'Short initials of faculty, e.g. RS' },
                  facultyFullName: { type: SchemaType.STRING, description: 'Full name of faculty from legend, e.g. MR RANJEET SINGH' },
                  room: { type: SchemaType.STRING, description: 'Classroom or Lab code, e.g. L-311 or 416' },
                  category: {
                    type: SchemaType.STRING,
                    format: 'enum',
                    enum: ['academic', 'skill_development', 'placement', 'self_learning'],
                    description: 'Category derived from cell color: Yellow = academic, Green = skill_development, Pink = placement, Blue = self_learning'
                  },
                  rawCellText: { type: SchemaType.STRING, description: 'Literal cell text parsed' }
                },
                required: [
                  'day',
                  'timeSlotStart',
                  'timeSlotEnd',
                  'isMergedSlot',
                  'sectionCodes',
                  'subjectCode',
                  'subjectName',
                  'facultyShortCode',
                  'facultyFullName',
                  'room',
                  'category',
                  'rawCellText'
                ]
              }
            }
          },
          required: ['gridId', 'slots'],
        },
      },
    });

    const imagePart = this.bufferToGenerativePart(pageImageBuffer, 'image/png');
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

    const result = await model.generateContent([imagePart, prompt]);
    const responseText = result.response.text();
    this.logger.log(`Gemini Grid slots response length: ${responseText.length}`);
    return JSON.parse(responseText) as ExtractedGridResponse;
  }

  private getMockHeader(rawTextContext: string): ExtractedHeader {
    const isDeptD = rawTextContext.includes('Section: D') || rawTextContext.includes('CSE-AIML');
    return {
      institute: 'BUDDHA INSTITUTE OF TECHNOLOGY, GIDA, GORAKHPUR',
      department: isDeptD ? 'CSE-AIML' : 'CSE-DS',
      effectiveFrom: '13 July, 2026',
      semester: '7TH',
      section: isDeptD ? 'D' : 'C',
      room: isDeptD ? '418' : '416',
    };
  }

  private getMockGrid(header: ExtractedHeader): ExtractedGridResponse {
    const isC = header.section === 'C';
    const slots: ExtractedSlot[] = [
      {
        day: 'MON',
        timeSlotStart: '9:10 AM',
        timeSlotEnd: '10:05 AM',
        isMergedSlot: false,
        sectionCodes: isC ? ['C'] : ['D1', 'D2'],
        subjectCode: 'BCS 070',
        subjectName: 'INTERNET OF THING (IOT)',
        facultyShortCode: 'KJ',
        facultyFullName: 'MR KRISHNA JAISWAL',
        room: isC ? '416' : '418',
        category: 'academic',
        rawCellText: isC ? 'IOT\n(KJ)' : 'DL LAB-(D1)-RS-L-311\nH-RANK-(D2)-PK-L-418',
      },
      {
        day: 'MON',
        timeSlotStart: '10:05 AM',
        timeSlotEnd: '11:00 AM',
        isMergedSlot: false,
        sectionCodes: isC ? ['C'] : ['D'],
        subjectCode: 'BAI 701',
        subjectName: 'DEEP LEARNING (DL)',
        facultyShortCode: 'RS',
        facultyFullName: 'MR RANJEET SINGH',
        room: isC ? '416' : '418',
        category: 'academic',
        rawCellText: 'DL\n(RS)',
      },
    ];

    return {
      gridId: `${header.department}-${header.section}`,
      slots,
    };
  }
}
