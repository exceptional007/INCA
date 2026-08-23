import { Injectable } from '@nestjs/common';

export interface ConflictDetail {
  type: 'FACULTY' | 'ROOM' | 'SECTION';
  message: string;
  slot1: {
    day: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    subjectName?: string;
    facultyName?: string;
    room?: string;
    sectionName?: string;
  };
  slot2: {
    day: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    subjectName?: string;
    facultyName?: string;
    room?: string;
    sectionName?: string;
  };
}

@Injectable()
export class ConflictService {
  parseTimeToMinutes(timeStr: string): number {
    const cleaned = timeStr.replace(/\s+/g, ' ').trim();
    const match = cleaned.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
    if (!match) {
      // Fallback: try parsing with space or no space
      const matchesWithSpace = cleaned.split(' ');
      if (matchesWithSpace.length >= 2) {
        const timeParts = matchesWithSpace[0].split(':');
        const ampm = matchesWithSpace[1].toUpperCase();
        if (timeParts.length === 2) {
          let h = parseInt(timeParts[0], 10);
          const m = parseInt(timeParts[1], 10);
          if (ampm === 'PM' && h !== 12) h += 12;
          if (ampm === 'AM' && h === 12) h = 0;
          return h * 60 + m;
        }
      }
      return 0;
    }
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();

    if (ampm === 'PM' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
      hours = 0;
    }

    return hours * 60 + minutes;
  }

  isOverlapping(
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ): boolean {
    const s1 = this.parseTimeToMinutes(start1);
    const e1 = this.parseTimeToMinutes(end1);
    const s2 = this.parseTimeToMinutes(start2);
    const e2 = this.parseTimeToMinutes(end2);

    if (s1 === 0 || e1 === 0 || s2 === 0 || e2 === 0) {
      return false;
    }

    return s1 < e2 && s2 < e1;
  }

  detectConflicts(
    newSlots: Array<{
      day: string;
      timeSlotStart: string;
      timeSlotEnd: string;
      subjectName: string;
      facultyFullName: string;
      facultyId?: string | null;
      roomId?: string | null;
      room: string;
      sectionCodes: string[];
      matchedSectionId?: string | null;
      sectionName?: string;
    }>,
    existingSlots: Array<{
      day: string;
      timeSlotStart: string;
      timeSlotEnd: string;
      subjectName: string;
      facultyName: string;
      facultyId: string;
      roomId: string;
      room: string;
      sectionName: string;
      sectionId: string;
    }>,
  ): ConflictDetail[] {
    const conflicts: ConflictDetail[] = [];

    // Step 1: Detect internal conflicts (among the new slots)
    for (let i = 0; i < newSlots.length; i++) {
      for (let j = i + 1; j < newSlots.length; j++) {
        const slotA = newSlots[i];
        const slotB = newSlots[j];

        if (slotA.day !== slotB.day) continue;
        if (!this.isOverlapping(slotA.timeSlotStart, slotA.timeSlotEnd, slotB.timeSlotStart, slotB.timeSlotEnd)) {
          continue;
        }

        // Section conflict (if they share any sections)
        const commonSections = slotA.sectionCodes.filter(sec => slotB.sectionCodes.includes(sec));
        if (commonSections.length > 0) {
          conflicts.push({
            type: 'SECTION',
            message: `Double class booked for section group(s) [${commonSections.join(', ')}] on ${slotA.day} at ${slotA.timeSlotStart}-${slotA.timeSlotEnd}.`,
            slot1: {
              day: slotA.day,
              timeSlotStart: slotA.timeSlotStart,
              timeSlotEnd: slotA.timeSlotEnd,
              subjectName: slotA.subjectName,
              facultyName: slotA.facultyFullName,
              room: slotA.room,
              sectionName: slotA.sectionCodes.join('+'),
            },
            slot2: {
              day: slotB.day,
              timeSlotStart: slotB.timeSlotStart,
              timeSlotEnd: slotB.timeSlotEnd,
              subjectName: slotB.subjectName,
              facultyName: slotB.facultyFullName,
              room: slotB.room,
              sectionName: slotB.sectionCodes.join('+'),
            },
          });
        }

        // Faculty conflict
        if (
          slotA.facultyFullName &&
          slotB.facultyFullName &&
          slotA.facultyFullName.toLowerCase().trim() === slotB.facultyFullName.toLowerCase().trim()
        ) {
          conflicts.push({
            type: 'FACULTY',
            message: `Faculty ${slotA.facultyFullName} is scheduled in two places simultaneously on ${slotA.day} at ${slotA.timeSlotStart}-${slotA.timeSlotEnd}.`,
            slot1: {
              day: slotA.day,
              timeSlotStart: slotA.timeSlotStart,
              timeSlotEnd: slotA.timeSlotEnd,
              subjectName: slotA.subjectName,
              room: slotA.room,
              sectionName: slotA.sectionCodes.join('+'),
            },
            slot2: {
              day: slotB.day,
              timeSlotStart: slotB.timeSlotStart,
              timeSlotEnd: slotB.timeSlotEnd,
              subjectName: slotB.subjectName,
              room: slotB.room,
              sectionName: slotB.sectionCodes.join('+'),
            },
          });
        }

        // Room conflict
        if (
          slotA.room &&
          slotB.room &&
          slotA.room.toLowerCase().trim() === slotB.room.toLowerCase().trim()
        ) {
          conflicts.push({
            type: 'ROOM',
            message: `Room ${slotA.room} is double-booked on ${slotA.day} at ${slotA.timeSlotStart}-${slotA.timeSlotEnd}.`,
            slot1: {
              day: slotA.day,
              timeSlotStart: slotA.timeSlotStart,
              timeSlotEnd: slotA.timeSlotEnd,
              subjectName: slotA.subjectName,
              facultyName: slotA.facultyFullName,
              sectionName: slotA.sectionCodes.join('+'),
            },
            slot2: {
              day: slotB.day,
              timeSlotStart: slotB.timeSlotStart,
              timeSlotEnd: slotB.timeSlotEnd,
              subjectName: slotB.subjectName,
              facultyName: slotB.facultyFullName,
              sectionName: slotB.sectionCodes.join('+'),
            },
          });
        }
      }
    }

    // Step 2: Detect conflicts with currently active timetables in the database
    for (const newSlot of newSlots) {
      for (const existSlot of existingSlots) {
        if (newSlot.day !== existSlot.day) continue;
        if (!this.isOverlapping(newSlot.timeSlotStart, newSlot.timeSlotEnd, existSlot.timeSlotStart, existSlot.timeSlotEnd)) {
          continue;
        }

        // Faculty conflict
        if (
          newSlot.facultyId &&
          newSlot.facultyId === existSlot.facultyId
        ) {
          conflicts.push({
            type: 'FACULTY',
            message: `Faculty member ${existSlot.facultyName} has a scheduling conflict with an existing class on ${newSlot.day} at ${newSlot.timeSlotStart}-${newSlot.timeSlotEnd}.`,
            slot1: {
              day: newSlot.day,
              timeSlotStart: newSlot.timeSlotStart,
              timeSlotEnd: newSlot.timeSlotEnd,
              subjectName: newSlot.subjectName,
              room: newSlot.room,
              sectionName: newSlot.sectionCodes.join('+'),
            },
            slot2: {
              day: existSlot.day,
              timeSlotStart: existSlot.timeSlotStart,
              timeSlotEnd: existSlot.timeSlotEnd,
              subjectName: existSlot.subjectName,
              room: existSlot.room,
              sectionName: existSlot.sectionName,
            },
          });
        }

        // Room conflict
        if (
          newSlot.roomId &&
          newSlot.roomId === existSlot.roomId
        ) {
          conflicts.push({
            type: 'ROOM',
            message: `Room ${existSlot.room} has a double-booking conflict with an existing class on ${newSlot.day} at ${newSlot.timeSlotStart}-${newSlot.timeSlotEnd}.`,
            slot1: {
              day: newSlot.day,
              timeSlotStart: newSlot.timeSlotStart,
              timeSlotEnd: newSlot.timeSlotEnd,
              subjectName: newSlot.subjectName,
              facultyName: newSlot.facultyFullName,
              sectionName: newSlot.sectionCodes.join('+'),
            },
            slot2: {
              day: existSlot.day,
              timeSlotStart: existSlot.timeSlotStart,
              timeSlotEnd: existSlot.timeSlotEnd,
              subjectName: existSlot.subjectName,
              facultyName: existSlot.facultyName,
              sectionName: existSlot.sectionName,
            },
          });
        }

        // Section conflict (if they share the exact same section ID)
        if (
          newSlot.matchedSectionId &&
          newSlot.matchedSectionId === existSlot.sectionId
        ) {
          conflicts.push({
            type: 'SECTION',
            message: `Section ${existSlot.sectionName} is already scheduled for another class on ${newSlot.day} at ${newSlot.timeSlotStart}-${newSlot.timeSlotEnd}.`,
            slot1: {
              day: newSlot.day,
              timeSlotStart: newSlot.timeSlotStart,
              timeSlotEnd: newSlot.timeSlotEnd,
              subjectName: newSlot.subjectName,
              facultyName: newSlot.facultyFullName,
              room: newSlot.room,
            },
            slot2: {
              day: existSlot.day,
              timeSlotStart: existSlot.timeSlotStart,
              timeSlotEnd: existSlot.timeSlotEnd,
              subjectName: existSlot.subjectName,
              facultyName: existSlot.facultyName,
              room: existSlot.room,
            },
          });
        }
      }
    }

    return conflicts;
  }
}
