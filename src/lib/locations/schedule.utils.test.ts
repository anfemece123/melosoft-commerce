import { describe, expect, it } from 'vitest';
import {
  createEmptyWeek,
  createNextInterval,
  validateWeeklySchedule,
} from './schedule.utils';

describe('weekly location schedules', () => {
  it('accepts two separate ordering shifts on the same day', () => {
    const schedule = createEmptyWeek();
    schedule[1] = [
      { startsAt: '10:00', endsAt: '15:00', endsNextDay: false, isAllDay: false },
      { startsAt: '18:00', endsAt: '22:00', endsNextDay: false, isAllDay: false },
    ];

    expect(validateWeeklySchedule(schedule)).toBeNull();
  });

  it('rejects overlapping shifts on the same day', () => {
    const schedule = createEmptyWeek();
    schedule[1] = [
      { startsAt: '10:00', endsAt: '15:00', endsNextDay: false, isAllDay: false },
      { startsAt: '14:00', endsAt: '22:00', endsNextDay: false, isAllDay: false },
    ];

    expect(validateWeeklySchedule(schedule)).toBe('Hay franjas superpuestas el lunes.');
  });

  it('suggests the common evening shift without overlapping a lunch shift', () => {
    expect(createNextInterval([
      { startsAt: '10:00', endsAt: '15:00', endsNextDay: false, isAllDay: false },
    ])).toEqual({
      startsAt: '18:00',
      endsAt: '22:00',
      endsNextDay: false,
      isAllDay: false,
    });
  });
});
