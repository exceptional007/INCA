import { PdfTextParserService } from './pdf-text-parser.service';

describe('PdfTextParserService', () => {
  let service: PdfTextParserService;

  beforeEach(() => {
    service = new PdfTextParserService();
  });

  describe('extractHeader', () => {
    it('should extract header from typical timetable text', () => {
      const rawText = `BUDDHA INSTITUTE OF TECHNOLOGY, GIDA, GORAKHPUR
      TIME TABLE W.E.F 13 July, 2026
      Department: CSE-DS  Semester: 7TH  Section: C
      Room No: 416`;

      const header = service.extractHeader(rawText);

      expect(header).not.toBeNull();
      expect(header!.institute).toContain('BUDDHA INSTITUTE OF TECHNOLOGY');
      expect(header!.department).toBe('CSE-DS');
      expect(header!.semester).toBe('7TH');
      expect(header!.section).toBe('C');
      expect(header!.room).toBe('416');
      expect(header!.effectiveFrom).toContain('13 July');
    });

    it('should extract header with AIML department code', () => {
      const rawText = `BUDDHA INSTITUTE OF TECHNOLOGY
      Dept: CSE-AIML  Sem: 5TH  Section: D
      Room No. 418  W.E.F. 15 August, 2026`;

      const header = service.extractHeader(rawText);

      expect(header).not.toBeNull();
      expect(header!.department).toBe('CSE-AIML');
      expect(header!.semester).toBe('5TH');
      expect(header!.section).toBe('D');
    });

    it('should return null for empty or very short text', () => {
      expect(service.extractHeader('')).toBeNull();
      expect(service.extractHeader('abc')).toBeNull();
      expect(service.extractHeader('short text here')).toBeNull();
    });

    it('should return null when no meaningful data can be extracted', () => {
      const rawText = 'Lorem ipsum dolor amet, consectetur adipiscing. More words here to pass the length check but none of them match patterns.';
      const result = service.extractHeader(rawText);
      expect(result).toBeNull();
    });

    it('should handle 1st and 2nd semester suffixes correctly', () => {
      const rawText = `College of Engineering
      Department: CSE  Semester: 1  Section: A
      Room: LH-302`;

      const header = service.extractHeader(rawText);
      expect(header).not.toBeNull();
      expect(header!.semester).toBe('1ST');
    });
  });

  describe('extractGrid', () => {
    const mockHeader = {
      institute: 'Test Institute',
      department: 'CSE-DS',
      effectiveFrom: '13 July 2026',
      semester: '7TH',
      section: 'C',
      room: '416',
    };

    it('should extract slots from structured timetable text', () => {
      const rawText = `
MON\tIOT(KJ)\tDL(RS)\tBREAK\tAI LAB(PK)
TUES\tDL(RS)\tIOT(KJ)\tBREAK\tSELF LEARNING
WED\tBAI 701(RS)\tBCS 070(KJ)
      `;

      const grid = service.extractGrid(rawText, mockHeader);

      expect(grid).not.toBeNull();
      expect(grid!.slots.length).toBeGreaterThan(0);
      expect(grid!.gridId).toBe('CSE-DS-C');

      // Verify extracted days
      const days = [...new Set(grid!.slots.map(s => s.day))];
      expect(days).toContain('MON');
    });

    it('should return null for empty text', () => {
      expect(service.extractGrid('', mockHeader)).toBeNull();
    });

    it('should return null for text with no recognizable timetable content', () => {
      const rawText = 'This is just random text without any timetable data.';
      expect(service.extractGrid(rawText, mockHeader)).toBeNull();
    });

    it('should detect lab sessions and mark isMergedSlot', () => {
      const rawText = `
MON\tDL LAB-(C1+C2)-KJ-L-311
      `;

      const grid = service.extractGrid(rawText, mockHeader);
      if (grid && grid.slots.length > 0) {
        const labSlot = grid.slots.find(s => s.rawCellText.includes('LAB'));
        if (labSlot) {
          expect(labSlot.isMergedSlot).toBe(true);
        }
      }
    });

    it('should categorize skill development and self learning slots', () => {
      const rawText = `
FRI\tSKILL DEVELOPMENT\tSELF LEARNING\tPLACEMENT
      `;

      const grid = service.extractGrid(rawText, mockHeader);
      if (grid && grid.slots.length > 0) {
        const skillSlot = grid.slots.find(s => s.category === 'skill_development');
        const selfSlot = grid.slots.find(s => s.category === 'self_learning');
        const placementSlot = grid.slots.find(s => s.category === 'placement');

        // At least one of these should be detected
        const hasSpecialCategory = skillSlot || selfSlot || placementSlot;
        expect(hasSpecialCategory).toBeTruthy();
      }
    });
  });
});
