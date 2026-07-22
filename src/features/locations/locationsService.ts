import { supabase } from '@/lib/supabase';
import type { Json, StoreLocationRowInsert, StoreLocationRowUpdate } from '@/types/database.types';
import type {
  LocationOrderStatus,
  LocationScheduleException,
  LocationScheduleInterval,
  LocationScheduleStatus,
  OrderScheduleMode,
  PublicStoreLocation,
  ScheduleIntervalInput,
  ScheduleKind,
  StoreLocation,
} from './locations.types';
import { mapLocationRowToStoreLocation, mapPublicLocationRowToPublicStoreLocation } from './locations.mapper';

export interface CreateLocationPayload {
  name: string;
  slug?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  allowsPickup?: boolean;
  allowsLocalDelivery?: boolean;
  phone?: string | null;
  whatsappNumber?: string | null;
  sortOrder?: number;
  deliveryNotes?: string | null;
  pickupNotes?: string | null;
  timezone?: string;
  orderScheduleMode?: OrderScheduleMode;
}

export interface UpdateLocationPayload {
  name?: string;
  slug?: string | null;
  addressLine?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  department?: string | null;
  country?: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isPrimary?: boolean;
  isActive?: boolean;
  isPublic?: boolean;
  allowsPickup?: boolean;
  allowsLocalDelivery?: boolean;
  phone?: string | null;
  whatsappNumber?: string | null;
  sortOrder?: number;
  deliveryNotes?: string | null;
  pickupNotes?: string | null;
  timezone?: string;
  orderScheduleMode?: OrderScheduleMode;
  ordersPaused?: boolean;
  ordersPausedUntil?: string | null;
  ordersPauseReason?: string | null;
}

function toUpdateRow(p: UpdateLocationPayload): StoreLocationRowUpdate {
  const row: StoreLocationRowUpdate = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.slug !== undefined) row.slug = p.slug;
  if (p.addressLine !== undefined) row.address_line = p.addressLine;
  if (p.neighborhood !== undefined) row.neighborhood = p.neighborhood;
  if (p.city !== undefined) row.city = p.city;
  if (p.department !== undefined) row.department = p.department;
  if (p.country !== undefined) row.country = p.country;
  if (p.postalCode !== undefined) row.postal_code = p.postalCode;
  if (p.latitude !== undefined) row.latitude = p.latitude;
  if (p.longitude !== undefined) row.longitude = p.longitude;
  if (p.isPrimary !== undefined) row.is_primary = p.isPrimary;
  if (p.isActive !== undefined) row.is_active = p.isActive;
  if (p.isPublic !== undefined) row.is_public = p.isPublic;
  if (p.allowsPickup !== undefined) row.allows_pickup = p.allowsPickup;
  if (p.allowsLocalDelivery !== undefined) row.allows_local_delivery = p.allowsLocalDelivery;
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.whatsappNumber !== undefined) row.whatsapp_number = p.whatsappNumber;
  if (p.sortOrder !== undefined) row.sort_order = p.sortOrder;
  if (p.deliveryNotes !== undefined) row.delivery_notes = p.deliveryNotes;
  if (p.pickupNotes !== undefined) row.pickup_notes = p.pickupNotes;
  if (p.timezone !== undefined) row.timezone = p.timezone;
  if (p.orderScheduleMode !== undefined) row.order_schedule_mode = p.orderScheduleMode;
  if (p.ordersPaused !== undefined) row.orders_paused = p.ordersPaused;
  if (p.ordersPausedUntil !== undefined) row.orders_paused_until = p.ordersPausedUntil;
  if (p.ordersPauseReason !== undefined) row.orders_pause_reason = p.ordersPauseReason;
  return row;
}

export const locationsService = {
  async getStoreLocations(storeId: string): Promise<StoreLocation[]> {
    const { data, error } = await supabase
      .from('store_locations')
      .select('*')
      .eq('store_id', storeId)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapLocationRowToStoreLocation);
  },

  async createLocation(storeId: string, payload: CreateLocationPayload): Promise<StoreLocation> {
    const row: StoreLocationRowInsert = {
      store_id: storeId,
      name: payload.name,
      slug: payload.slug ?? null,
      address_line: payload.addressLine ?? null,
      neighborhood: payload.neighborhood ?? null,
      city: payload.city ?? null,
      department: payload.department ?? null,
      country: payload.country ?? 'CO',
      postal_code: payload.postalCode ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      is_primary: payload.isPrimary ?? false,
      is_active: payload.isActive ?? true,
      is_public: payload.isPublic ?? true,
      allows_pickup: payload.allowsPickup ?? true,
      allows_local_delivery: payload.allowsLocalDelivery ?? false,
      phone: payload.phone ?? null,
      whatsapp_number: payload.whatsappNumber ?? null,
      sort_order: payload.sortOrder ?? 0,
      delivery_notes: payload.deliveryNotes ?? null,
      pickup_notes: payload.pickupNotes ?? null,
      timezone: payload.timezone ?? 'America/Bogota',
      order_schedule_mode: payload.orderScheduleMode ?? 'always_open',
    };

    const { data, error } = await supabase
      .from('store_locations')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLocationRowToStoreLocation(data);
  },

  async updateLocation(locationId: string, payload: UpdateLocationPayload): Promise<StoreLocation> {
    const { data, error } = await supabase
      .from('store_locations')
      .update(toUpdateRow(payload))
      .eq('id', locationId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return mapLocationRowToStoreLocation(data);
  },

  async deleteLocation(locationId: string): Promise<void> {
    const { error } = await supabase
      .from('store_locations')
      .delete()
      .eq('id', locationId);

    if (error) throw new Error(error.message);
  },

  async setPrimaryLocation(storeId: string, locationId: string): Promise<void> {
    const { error } = await supabase
      .from('store_locations')
      .update({ is_primary: true })
      .eq('id', locationId)
      .eq('store_id', storeId);

    if (error) throw new Error(error.message);
  },

  async getPublicStoreLocations(storeSlug: string): Promise<PublicStoreLocation[]> {
    const { data, error } = await supabase
      .from('public_store_locations')
      .select('*')
      .eq('store_slug', storeSlug)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapPublicLocationRowToPublicStoreLocation);
  },

  async getLocationSchedule(
    locationId: string,
    scheduleKind?: ScheduleKind,
  ): Promise<LocationScheduleInterval[]> {
    let query = supabase
      .from('location_schedule_intervals')
      .select('*')
      .eq('location_id', locationId)
      .order('day_of_week', { ascending: true })
      .order('sort_order', { ascending: true });

    if (scheduleKind) query = query.eq('schedule_kind', scheduleKind);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      storeId: row.store_id,
      locationId: row.location_id,
      scheduleKind: row.schedule_kind as ScheduleKind,
      dayOfWeek: row.day_of_week,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      endsNextDay: row.ends_next_day,
      isAllDay: row.is_all_day,
      sortOrder: row.sort_order,
    }));
  },

  async saveScheduleConfiguration(input: {
    locationId: string;
    timezone: string;
    orderScheduleMode: OrderScheduleMode;
    ordersPaused: boolean;
    ordersPausedUntil: string | null;
    ordersPauseReason: string | null;
    businessSchedule: Record<number, ScheduleIntervalInput[]>;
    orderingSchedule: Record<number, ScheduleIntervalInput[]>;
  }): Promise<void> {
    const flatten = (schedule: Record<number, ScheduleIntervalInput[]>) =>
      Object.entries(schedule).flatMap(([day, intervals]) =>
        intervals.map((interval, index) => ({
          day_of_week: Number(day),
          starts_at: interval.isAllDay ? null : interval.startsAt,
          ends_at: interval.isAllDay ? null : interval.endsAt,
          ends_next_day: interval.isAllDay ? false : interval.endsNextDay,
          is_all_day: interval.isAllDay,
          sort_order: index,
        })),
      );

    const { error } = await supabase.rpc('save_location_schedule_configuration', {
      p_location_id: input.locationId,
      p_timezone: input.timezone,
      p_order_schedule_mode: input.orderScheduleMode,
      p_orders_paused: input.ordersPaused,
      p_orders_paused_until: input.ordersPausedUntil,
      p_orders_pause_reason: input.ordersPauseReason,
      p_business_intervals: flatten(input.businessSchedule) as unknown as Json,
      p_ordering_intervals: flatten(input.orderingSchedule) as unknown as Json,
    });
    if (error) throw new Error(error.message);
  },

  async getLocationExceptions(locationId: string): Promise<LocationScheduleException[]> {
    const { data, error } = await supabase
      .from('location_schedule_exceptions')
      .select('*')
      .eq('location_id', locationId)
      .order('exception_date', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => {
      const rawIntervals = row.intervals as unknown as Array<{
        starts_at?: string | null;
        ends_at?: string | null;
        ends_next_day?: boolean;
        is_all_day?: boolean;
      }>;
      return {
        id: row.id,
        storeId: row.store_id,
        locationId: row.location_id,
        scheduleKind: row.schedule_kind as ScheduleKind,
        exceptionDate: row.exception_date,
        isClosed: row.is_closed,
        intervals: rawIntervals.map((interval) => ({
          startsAt: interval.starts_at?.slice(0, 5) ?? null,
          endsAt: interval.ends_at?.slice(0, 5) ?? null,
          endsNextDay: interval.ends_next_day === true,
          isAllDay: interval.is_all_day === true,
        })),
        note: row.note,
      };
    });
  },

  async saveLocationException(input: Omit<LocationScheduleException, 'id'>): Promise<void> {
    const { error } = await supabase
      .from('location_schedule_exceptions')
      .upsert({
        store_id: input.storeId,
        location_id: input.locationId,
        schedule_kind: input.scheduleKind,
        exception_date: input.exceptionDate,
        is_closed: input.isClosed,
        intervals: input.intervals.map((interval) => ({
          starts_at: interval.isAllDay ? null : interval.startsAt,
          ends_at: interval.isAllDay ? null : interval.endsAt,
          ends_next_day: interval.isAllDay ? false : interval.endsNextDay,
          is_all_day: interval.isAllDay,
        })) as unknown as Json,
        note: input.note,
      }, { onConflict: 'location_id,schedule_kind,exception_date' });
    if (error) throw new Error(error.message);
  },

  async deleteLocationException(exceptionId: string): Promise<void> {
    const { error } = await supabase
      .from('location_schedule_exceptions')
      .delete()
      .eq('id', exceptionId);
    if (error) throw new Error(error.message);
  },

  async getLocationOrderStatus(locationId: string): Promise<LocationOrderStatus> {
    const { data, error } = await supabase.rpc('get_location_order_status', {
      p_location_id: locationId,
    });
    if (error) throw new Error(error.message);
    const status = (data ?? {}) as Record<string, unknown>;
    return {
      isAcceptingOrders: status.is_accepting_orders === true,
      statusCode: (status.status_code as LocationOrderStatus['statusCode']) ?? 'closed',
      timezone: typeof status.timezone === 'string' ? status.timezone : null,
      localDate: typeof status.local_date === 'string' ? status.local_date : null,
      localTime: typeof status.local_time === 'string' ? status.local_time : null,
      pausedUntil: typeof status.paused_until === 'string' ? status.paused_until : null,
      pauseReason: typeof status.pause_reason === 'string' ? status.pause_reason : null,
    };
  },

  async getLocationScheduleStatus(
    locationId: string,
    scheduleKind: ScheduleKind,
  ): Promise<LocationScheduleStatus> {
    const { data, error } = await supabase.rpc('get_location_schedule_status', {
      p_location_id: locationId,
      p_schedule_kind: scheduleKind,
    });
    if (error) throw new Error(error.message);
    const status = (data ?? {}) as Record<string, unknown>;
    return {
      isOpen: status.is_open === true,
      statusCode: (status.status_code as LocationScheduleStatus['statusCode']) ?? 'closed',
      timezone: typeof status.timezone === 'string' ? status.timezone : null,
      localDate: typeof status.local_date === 'string' ? status.local_date : null,
      localTime: typeof status.local_time === 'string' ? status.local_time : null,
    };
  },
};
