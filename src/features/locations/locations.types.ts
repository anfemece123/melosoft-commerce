export interface StoreLocation {
  id: string;
  storeId: string;
  name: string;
  slug: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  department: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isPrimary: boolean;
  isActive: boolean;
  isPublic: boolean;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  phone: string | null;
  whatsappNumber: string | null;
  sortOrder: number;
  deliveryNotes: string | null;
  pickupNotes: string | null;
  timezone: string;
  orderScheduleMode: OrderScheduleMode;
  ordersPaused: boolean;
  ordersPausedUntil: string | null;
  ordersPauseReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreLocationInsert = Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreLocationUpdate = Partial<Omit<StoreLocationInsert, 'storeId'>>;

export interface PublicStoreLocation {
  locationId: string;
  storeId: string;
  storeSlug: string;
  name: string;
  city: string | null;
  department: string | null;
  country: string | null;
  addressLine: string | null;
  neighborhood: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  allowsPickup: boolean;
  allowsLocalDelivery: boolean;
  deliveryNotes: string | null;
  pickupNotes: string | null;
  isPrimary: boolean;
  sortOrder: number;
  timezone: string;
  orderScheduleMode: OrderScheduleMode;
}

export type ScheduleKind = 'business' | 'ordering';
export type OrderScheduleMode = 'always_open' | 'same_as_business' | 'custom';

export interface LocationScheduleInterval {
  id: string;
  storeId: string;
  locationId: string;
  scheduleKind: ScheduleKind;
  dayOfWeek: number;
  startsAt: string | null;
  endsAt: string | null;
  endsNextDay: boolean;
  isAllDay: boolean;
  sortOrder: number;
}

export interface ScheduleIntervalInput {
  startsAt: string | null;
  endsAt: string | null;
  endsNextDay: boolean;
  isAllDay: boolean;
}

export interface LocationScheduleException {
  id: string;
  storeId: string;
  locationId: string;
  scheduleKind: ScheduleKind;
  exceptionDate: string;
  isClosed: boolean;
  intervals: ScheduleIntervalInput[];
  note: string | null;
}

export interface LocationOrderStatus {
  isAcceptingOrders: boolean;
  statusCode: 'open' | 'closed' | 'paused' | 'inactive' | 'no_schedule';
  timezone: string | null;
  localDate: string | null;
  localTime: string | null;
  pausedUntil: string | null;
  pauseReason: string | null;
}

export interface LocationScheduleStatus {
  isOpen: boolean;
  statusCode: 'open' | 'closed' | 'inactive' | 'no_schedule';
  timezone: string | null;
  localDate: string | null;
  localTime: string | null;
}
