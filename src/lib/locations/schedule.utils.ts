import type {
  LocationScheduleInterval,
  ScheduleIntervalInput,
} from '@/features/locations/locations.types';

export const SCHEDULE_DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export const SCHEDULE_DAY_NAMES: Record<number, string> = {
  0: 'Domingo',
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
};

export type WeeklySchedule = Record<number, ScheduleIntervalInput[]>;

export function createEmptyWeek(): WeeklySchedule {
  return { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
}

export function defaultWeekdaySchedule(): WeeklySchedule {
  return {
    ...createEmptyWeek(),
    1: [createInterval()],
    2: [createInterval()],
    3: [createInterval()],
    4: [createInterval()],
    5: [createInterval()],
    6: [{ ...createInterval(), endsAt: '14:00' }],
  };
}

export function createInterval(): ScheduleIntervalInput {
  return { startsAt: '08:00', endsAt: '18:00', endsNextDay: false, isAllDay: false };
}

export function intervalsToWeek(intervals: LocationScheduleInterval[]): WeeklySchedule {
  const week = createEmptyWeek();
  for (const interval of intervals) {
    week[interval.dayOfWeek].push({
      startsAt: trimTime(interval.startsAt),
      endsAt: trimTime(interval.endsAt),
      endsNextDay: interval.endsNextDay,
      isAllDay: interval.isAllDay,
    });
  }
  return week;
}

export function trimTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function formatScheduleInterval(interval: ScheduleIntervalInput): string {
  if (interval.isAllDay) return '24 horas';
  const suffix = interval.endsNextDay ? ' (día siguiente)' : '';
  return `${formatTime(interval.startsAt)} – ${formatTime(interval.endsAt)}${suffix}`;
}

export function formatTime(value: string | null): string {
  if (!value) return '';
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function minutes(value: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function validateWeeklySchedule(schedule: WeeklySchedule): string | null {
  for (const day of SCHEDULE_DAY_ORDER) {
    const intervals = schedule[day] ?? [];
    if (intervals.some((interval) => interval.isAllDay) && intervals.length > 1) {
      return `${SCHEDULE_DAY_NAMES[day]} no puede combinar “24 horas” con otras franjas.`;
    }

    const ranges: Array<{ start: number; end: number }> = [];
    for (const interval of intervals) {
      if (interval.isAllDay) continue;
      const start = minutes(interval.startsAt);
      const end = minutes(interval.endsAt);
      if (start === null || end === null) {
        return `Completa las horas de ${SCHEDULE_DAY_NAMES[day]}.`;
      }
      if (!interval.endsNextDay && start >= end) {
        return `La hora final de ${SCHEDULE_DAY_NAMES[day]} debe ser posterior a la inicial.`;
      }
      if (interval.endsNextDay && start < end) {
        return `La franja nocturna de ${SCHEDULE_DAY_NAMES[day]} debe terminar al día siguiente.`;
      }
      ranges.push({ start, end: interval.endsNextDay ? end + 1440 : end });
    }

    ranges.sort((a, b) => a.start - b.start);
    for (let index = 1; index < ranges.length; index += 1) {
      if (ranges[index].start < ranges[index - 1].end) {
        return `Hay franjas superpuestas el ${SCHEDULE_DAY_NAMES[day].toLowerCase()}.`;
      }
    }

    const nextDay = (day + 1) % 7;
    const overnightEnds = intervals
      .filter((interval) => interval.endsNextDay && !interval.isAllDay)
      .map((interval) => minutes(interval.endsAt) ?? 0);
    if (overnightEnds.length > 0) {
      const nextIntervals = schedule[nextDay] ?? [];
      const nextStarts = nextIntervals.map((interval) => interval.isAllDay ? 0 : (minutes(interval.startsAt) ?? 0));
      if (nextStarts.some((start) => overnightEnds.some((end) => start < end))) {
        return `El cierre nocturno de ${SCHEDULE_DAY_NAMES[day]} se superpone con ${SCHEDULE_DAY_NAMES[nextDay].toLowerCase()}.`;
      }
    }
  }
  return null;
}

export function cloneWeek(schedule: WeeklySchedule): WeeklySchedule {
  return Object.fromEntries(
    Object.entries(schedule).map(([day, intervals]) => [
      Number(day),
      intervals.map((interval) => ({ ...interval })),
    ]),
  ) as WeeklySchedule;
}

export interface ScheduleSummaryRow {
  days: string;
  hours: string;
}

export function summarizeWeeklySchedule(intervals: LocationScheduleInterval[]): ScheduleSummaryRow[] {
  const week = intervalsToWeek(intervals);
  const rows = SCHEDULE_DAY_ORDER.map((day) => ({
    day,
    hours: week[day].length > 0
      ? week[day].map(formatScheduleInterval).join(', ')
      : 'Cerrado',
  }));

  const groups: Array<{ start: number; end: number; hours: string }> = [];
  for (const row of rows) {
    const previous = groups[groups.length - 1];
    if (previous && previous.hours === row.hours) previous.end = row.day;
    else groups.push({ start: row.day, end: row.day, hours: row.hours });
  }

  return groups.map((group) => ({
    days: group.start === group.end
      ? SCHEDULE_DAY_NAMES[group.start]
      : `${SCHEDULE_DAY_NAMES[group.start]} – ${SCHEDULE_DAY_NAMES[group.end]}`,
    hours: group.hours,
  }));
}
