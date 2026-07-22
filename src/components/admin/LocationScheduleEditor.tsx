import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Copy,
  Plus,
  Save,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SwitchField } from '@/components/ui/SwitchField';
import { locationsService } from '@/features/locations/locationsService';
import type {
  LocationScheduleException,
  OrderScheduleMode,
  ScheduleIntervalInput,
  ScheduleKind,
  StoreLocation,
} from '@/features/locations/locations.types';
import {
  cloneWeek,
  createEmptyWeek,
  createInterval,
  formatScheduleInterval,
  SCHEDULE_DAY_NAMES,
  SCHEDULE_DAY_ORDER,
  type WeeklySchedule,
  validateWeeklySchedule,
} from '@/lib/locations/schedule.utils';
import { notify } from '@/lib/notifications';

const TIMEZONES = [
  { value: 'America/Bogota', label: 'Bogotá / Colombia (UTC−5)' },
  { value: 'America/Lima', label: 'Lima (UTC−5)' },
  { value: 'America/Mexico_City', label: 'Ciudad de México' },
  { value: 'America/New_York', label: 'Nueva York' },
  { value: 'Europe/Madrid', label: 'Madrid' },
];

const ORDER_MODES = [
  { value: 'always_open', label: 'Aceptar pedidos las 24 horas' },
  { value: 'same_as_business', label: 'Usar el horario del local' },
  { value: 'custom', label: 'Definir un horario exclusivo para pedidos' },
];

interface LocationScheduleEditorProps {
  location: StoreLocation;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

type EditorTab = 'business' | 'ordering' | 'exceptions';

function toZonedLocalDateTime(value: string | null, timeZone: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function zonedLocalDateTimeToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('La fecha de finalización de la pausa no es válida.');
  const [, year, month, day, hour, minute] = match;
  const wallClockUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  const offsetAt = (instant: number) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value ?? 0);
    const representedAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
    return representedAsUtc - instant;
  };
  let instant = wallClockUtc - offsetAt(wallClockUtc);
  instant = wallClockUtc - offsetAt(instant);
  return new Date(instant).toISOString();
}

function WeeklyScheduleEditor({
  value,
  onChange,
}: {
  value: WeeklySchedule;
  onChange: (value: WeeklySchedule) => void;
}) {
  function setDay(day: number, intervals: ScheduleIntervalInput[]) {
    onChange({ ...value, [day]: intervals });
  }

  function updateInterval(day: number, index: number, patch: Partial<ScheduleIntervalInput>) {
    const intervals = value[day].map((interval, current) =>
      current === index ? { ...interval, ...patch } : interval,
    );
    setDay(day, intervals);
  }

  function copyMondayToAll() {
    const monday = value[1].map((interval) => ({ ...interval }));
    const next = cloneWeek(value);
    for (const day of SCHEDULE_DAY_ORDER) next[day] = monday.map((interval) => ({ ...interval }));
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="ghost" onClick={copyMondayToAll}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copiar lunes a toda la semana
        </Button>
      </div>

      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {SCHEDULE_DAY_ORDER.map((day) => {
          const intervals = value[day] ?? [];
          return (
            <div key={day} className="grid gap-3 px-4 py-3 lg:grid-cols-[110px_1fr]">
              <div className="pt-2">
                <p className="text-sm font-semibold text-gray-800">{SCHEDULE_DAY_NAMES[day]}</p>
                <p className="text-xs text-gray-400">{intervals.length === 0 ? 'Cerrado' : 'Abierto'}</p>
              </div>

              <div className="space-y-2">
                {intervals.map((interval, index) => (
                  <div key={index} className="rounded-lg bg-gray-50 p-3">
                    <div className="flex flex-wrap items-end gap-2">
                      {!interval.isAllDay ? (
                        <>
                          <Input
                            type="time"
                            aria-label={`Hora de apertura del ${SCHEDULE_DAY_NAMES[day]}`}
                            value={interval.startsAt ?? ''}
                            onChange={(event) => updateInterval(day, index, { startsAt: event.target.value })}
                            className="w-32"
                          />
                          <span className="pb-2 text-sm text-gray-400">a</span>
                          <Input
                            type="time"
                            aria-label={`Hora de cierre del ${SCHEDULE_DAY_NAMES[day]}`}
                            value={interval.endsAt ?? ''}
                            onChange={(event) => updateInterval(day, index, { endsAt: event.target.value })}
                            className="w-32"
                          />
                        </>
                      ) : (
                        <div className="flex h-10 items-center text-sm font-medium text-indigo-700">Abierto 24 horas</div>
                      )}

                      <label className="flex h-10 items-center gap-2 px-1 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                          checked={interval.isAllDay}
                          onChange={(event) => updateInterval(day, index, {
                            isAllDay: event.target.checked,
                            startsAt: event.target.checked ? null : '08:00',
                            endsAt: event.target.checked ? null : '18:00',
                            endsNextDay: false,
                          })}
                        />
                        24 horas
                      </label>

                      {!interval.isAllDay && (
                        <label className="flex h-10 items-center gap-2 px-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                            checked={interval.endsNextDay}
                            onChange={(event) => updateInterval(day, index, { endsNextDay: event.target.checked })}
                          />
                          Termina al día siguiente
                        </label>
                      )}

                      <button
                        type="button"
                        className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Eliminar franja"
                        onClick={() => setDay(day, intervals.filter((_, current) => current !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setDay(day, [...intervals, createInterval()])}
                  disabled={intervals.some((interval) => interval.isAllDay)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {intervals.length === 0 ? 'Abrir este día' : 'Agregar franja'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LocationScheduleEditor({ location, onClose, onSaved }: LocationScheduleEditorProps) {
  const [tab, setTab] = useState<EditorTab>('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessSchedule, setBusinessSchedule] = useState<WeeklySchedule>(createEmptyWeek);
  const [orderingSchedule, setOrderingSchedule] = useState<WeeklySchedule>(createEmptyWeek);
  const [exceptions, setExceptions] = useState<LocationScheduleException[]>([]);
  const [timezone, setTimezone] = useState(location.timezone);
  const [orderMode, setOrderMode] = useState<OrderScheduleMode>(location.orderScheduleMode);
  const [ordersPaused, setOrdersPaused] = useState(location.ordersPaused);
  const [pausedUntil, setPausedUntil] = useState(toZonedLocalDateTime(location.ordersPausedUntil, location.timezone));
  const [pauseReason, setPauseReason] = useState(location.ordersPauseReason ?? '');
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionKind, setExceptionKind] = useState<ScheduleKind>('business');
  const [exceptionClosed, setExceptionClosed] = useState(true);
  const [exceptionNote, setExceptionNote] = useState('');
  const [exceptionIntervals, setExceptionIntervals] = useState<ScheduleIntervalInput[]>([createInterval()]);

  const load = useCallback(async () => {
    try {
      const [intervals, loadedExceptions, currentOrderStatus] = await Promise.all([
        locationsService.getLocationSchedule(location.id),
        locationsService.getLocationExceptions(location.id),
        locationsService.getLocationOrderStatus(location.id),
      ]);
      const business = createEmptyWeek();
      const ordering = createEmptyWeek();
      for (const interval of intervals) {
        const target = interval.scheduleKind === 'business' ? business : ordering;
        target[interval.dayOfWeek].push({
          startsAt: interval.startsAt?.slice(0, 5) ?? null,
          endsAt: interval.endsAt?.slice(0, 5) ?? null,
          endsNextDay: interval.endsNextDay,
          isAllDay: interval.isAllDay,
        });
      }
      setBusinessSchedule(business);
      setOrderingSchedule(ordering);
      setExceptions(loadedExceptions);
      setOrdersPaused(currentOrderStatus.statusCode === 'paused');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No fue posible cargar los horarios.');
    } finally {
      setLoading(false);
    }
  }, [location.id]);

  // Loading remote data is the external synchronization performed here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function handleSave() {
    const businessError = validateWeeklySchedule(businessSchedule);
    const orderingError = orderMode === 'custom' ? validateWeeklySchedule(orderingSchedule) : null;
    if (businessError || orderingError) {
      notify.error(businessError ?? orderingError ?? 'Revisa los horarios.');
      return;
    }

    try {
      setSaving(true);
      await locationsService.saveScheduleConfiguration({
        locationId: location.id,
        timezone,
        orderScheduleMode: orderMode,
        ordersPaused,
        ordersPausedUntil: ordersPaused && pausedUntil ? zonedLocalDateTimeToIso(pausedUntil, timezone) : null,
        ordersPauseReason: ordersPaused && pauseReason.trim() ? pauseReason.trim() : null,
        businessSchedule,
        orderingSchedule,
      });
      notify.success('Horarios guardados correctamente.');
      await onSaved();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No fue posible guardar los horarios.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveException() {
    if (!exceptionDate) {
      notify.error('Selecciona la fecha de la excepción.');
      return;
    }
    const candidate = createEmptyWeek();
    candidate[1] = exceptionClosed ? [] : exceptionIntervals;
    const error = validateWeeklySchedule(candidate);
    if (error) {
      notify.error(error.replace('Lunes', 'La excepción'));
      return;
    }
    try {
      setSaving(true);
      await locationsService.saveLocationException({
        storeId: location.storeId,
        locationId: location.id,
        scheduleKind: exceptionKind,
        exceptionDate,
        isClosed: exceptionClosed,
        intervals: exceptionClosed ? [] : exceptionIntervals,
        note: exceptionNote.trim() || null,
      });
      setExceptionDate('');
      setExceptionNote('');
      setExceptionClosed(true);
      setExceptionIntervals([createInterval()]);
      await load();
      notify.success('Excepción guardada.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No fue posible guardar la excepción.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteException(exceptionId: string) {
    try {
      await locationsService.deleteLocationException(exceptionId);
      setExceptions((current) => current.filter((item) => item.id !== exceptionId));
      notify.success('Excepción eliminada.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'No fue posible eliminar la excepción.');
    }
  }

  if (loading) {
    return <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-8 text-center text-sm text-gray-500">Cargando horarios…</div>;
  }

  const tabs: Array<{ value: EditorTab; label: string; icon: typeof Clock3 }> = [
    { value: 'business', label: 'Horario del local', icon: Clock3 },
    { value: 'ordering', label: 'Horario de pedidos', icon: ShoppingBag },
    { value: 'exceptions', label: 'Fechas especiales', icon: CalendarDays },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-indigo-100 bg-white px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Horarios · {location.name}</h3>
            <Badge variant={ordersPaused ? 'warning' : 'success'}>
              {ordersPaused ? 'Pedidos pausados' : 'Configuración activa'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-gray-500">El horario visible del local y el horario de pedidos se administran por separado.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar editor">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-indigo-100 bg-white px-4">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium ${tab === item.value ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-5 p-5">
        {tab === 'business' && (
          <>
            <div className="max-w-md">
              <Select
                label="Zona horaria de esta sede"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                options={TIMEZONES}
                hint="La apertura y el cierre se calculan con esta zona, no con la hora del dispositivo del cliente."
              />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Horario público del local</h4>
              <p className="mb-3 mt-1 text-xs text-gray-500">Este horario es informativo y se mostrará en la página de la empresa.</p>
              <WeeklyScheduleEditor value={businessSchedule} onChange={setBusinessSchedule} />
            </div>
          </>
        )}

        {tab === 'ordering' && (
          <>
            <Select
              label="¿Cuándo se pueden realizar pedidos en la tienda online?"
              value={orderMode}
              onChange={(event) => setOrderMode(event.target.value as OrderScheduleMode)}
              options={ORDER_MODES}
              hint="Este ajuste controla tanto los pedidos contra entrega como el inicio de pagos online."
            />

            {orderMode === 'custom' && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Horario exclusivo para pedidos</h4>
                <p className="mb-3 mt-1 text-xs text-gray-500">Puedes usar varias franjas y horarios nocturnos.</p>
                <WeeklyScheduleEditor value={orderingSchedule} onChange={setOrderingSchedule} />
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <SwitchField
                id={`pause-orders-${location.id}`}
                label="Pausar pedidos temporalmente"
                description="Tiene prioridad sobre cualquier horario configurado. El catálogo seguirá visible."
                checked={ordersPaused}
                onChange={setOrdersPaused}
              />
              {ordersPaused && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <Input
                    label="Pausar hasta (opcional)"
                    type="datetime-local"
                    value={pausedUntil}
                    onChange={(event) => setPausedUntil(event.target.value)}
                    hint={`Hora local de ${timezone}. Si queda vacío, la pausa continúa hasta que la desactives.`}
                  />
                  <Input
                    label="Motivo interno (opcional)"
                    maxLength={180}
                    value={pauseReason}
                    onChange={(event) => setPauseReason(event.target.value)}
                    placeholder="Alta demanda, mantenimiento…"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'exceptions' && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Nueva fecha especial</h4>
                <p className="mt-1 text-xs text-gray-500">Cierra una fecha concreta o reemplaza su horario habitual.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Fecha" type="date" value={exceptionDate} onChange={(event) => setExceptionDate(event.target.value)} />
                <Select
                  label="Aplica a"
                  value={exceptionKind}
                  onChange={(event) => setExceptionKind(event.target.value as ScheduleKind)}
                  options={[
                    { value: 'business', label: 'Horario del local' },
                    { value: 'ordering', label: 'Horario de pedidos personalizado' },
                  ]}
                />
              </div>
              <Input label="Nota (opcional)" maxLength={180} value={exceptionNote} onChange={(event) => setExceptionNote(event.target.value)} placeholder="Festivo, evento privado…" />
              <SwitchField
                id={`exception-closed-${location.id}`}
                label="Cerrado todo el día"
                checked={exceptionClosed}
                onChange={setExceptionClosed}
              />
              {!exceptionClosed && (
                <div className="space-y-2">
                  {exceptionIntervals.map((interval, index) => (
                    <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-3">
                      {!interval.isAllDay ? (
                        <>
                          <Input type="time" value={interval.startsAt ?? ''} onChange={(event) => setExceptionIntervals((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, startsAt: event.target.value } : item))} className="w-32" />
                          <span className="text-sm text-gray-400">a</span>
                          <Input type="time" value={interval.endsAt ?? ''} onChange={(event) => setExceptionIntervals((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, endsAt: event.target.value } : item))} className="w-32" />
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input type="checkbox" checked={interval.endsNextDay} onChange={(event) => setExceptionIntervals((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, endsNextDay: event.target.checked } : item))} />
                            Día siguiente
                          </label>
                        </>
                      ) : <span className="text-sm font-medium text-indigo-700">Abierto 24 horas</span>}
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input
                          type="checkbox"
                          checked={interval.isAllDay}
                          onChange={(event) => setExceptionIntervals((current) => current.map((item, currentIndex) => currentIndex === index ? {
                            ...item,
                            isAllDay: event.target.checked,
                            startsAt: event.target.checked ? null : '08:00',
                            endsAt: event.target.checked ? null : '18:00',
                            endsNextDay: false,
                          } : item))}
                        />
                        24 horas
                      </label>
                      <button type="button" aria-label="Eliminar franja" onClick={() => setExceptionIntervals((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="ml-auto rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <Button type="button" size="sm" variant="ghost" disabled={exceptionIntervals.some((interval) => interval.isAllDay)} onClick={() => setExceptionIntervals((current) => [...current, createInterval()])}><Plus className="mr-1 h-3.5 w-3.5" />Agregar franja</Button>
                </div>
              )}
              <Button type="button" onClick={() => void handleSaveException()} disabled={saving}>Guardar fecha especial</Button>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">Excepciones registradas</h4>
              {exceptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">No hay fechas especiales configuradas.</div>
              ) : exceptions.map((exception) => (
                <div key={exception.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${exception.exceptionDate}T00:00:00Z`))}</span>
                      <Badge variant={exception.isClosed ? 'danger' : 'info'}>{exception.isClosed ? 'Cerrado' : 'Horario especial'}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{exception.scheduleKind === 'business' ? 'Local' : 'Pedidos'}{exception.note ? ` · ${exception.note}` : ''}</p>
                    {!exception.isClosed && <p className="mt-1 text-xs text-gray-600">{exception.intervals.map(formatScheduleInterval).join(', ')}</p>}
                  </div>
                  <button type="button" aria-label="Eliminar excepción" onClick={() => void handleDeleteException(exception.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab !== 'exceptions' && (
          <div className="flex justify-end gap-3 border-t border-indigo-100 pt-5">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={() => void handleSave()} isLoading={saving} leftIcon={<Save className="h-4 w-4" />}>Guardar horarios</Button>
          </div>
        )}
      </div>
    </div>
  );
}
