import type {
  AsyncStatus,
  BusinessVertical,
  StoreStatus,
  ThemeMode,
  TemplateKey,
  StoreMemberRole,
  StoreMemberStatus,
  PlanKey,
  BusinessType,
  ThemePreset,
  PublicHeaderSettings,
} from '@/types/common.types';
import type { StoreCommerceSettings } from './storeCommerce.types';

export interface StoreTheme {
  id: string;
  storeId: string;
  mode: ThemeMode;
  themePreset: ThemePreset;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonRadius: string | null;
  templateKey: TemplateKey;
  headerSettings?: PublicHeaderSettings | null;
  createdAt: string;
  updatedAt: string;
}

export interface StorePolicies {
  id: string;
  storeId: string;
  shippingPolicy: string | null;
  returnsPolicy: string | null;
  warrantyPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreLocation {
  id: string;
  storeId: string;
  addressLine: string | null;
  neighborhood: string | null;
  city: string | null;
  department: string | null;
  country: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreLocationInsert = Omit<StoreLocation, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreLocationUpdate = Partial<Omit<StoreLocationInsert, 'storeId'>>;

export interface StoreBusinessHour {
  id: string;
  storeId: string;
  dayOfWeek: number;
  isOpen: boolean;
  opensAt: string | null;
  closesAt: string | null;
  breakStartsAt: string | null;
  breakEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreBusinessHourInsert = Omit<StoreBusinessHour, 'id' | 'createdAt' | 'updatedAt'>;

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  slogan: string | null;
  businessType: BusinessType | null;
  businessVertical: BusinessVertical | null;
  businessSubcategory: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroEnabled: boolean;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaLabel: string | null;
  heroImageUrl: string | null;
  heroBackgroundImageUrl: string | null;
  whatsappNumber: string | null;
  supportEmail: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  country: string;
  city: string | null;
  currency: string;
  status: StoreStatus;
  theme?: StoreTheme;
  policies?: StorePolicies;
  createdAt: string;
  updatedAt: string;
}

export type StoreInsert = Omit<Store, 'id' | 'ownerId' | 'theme' | 'policies' | 'createdAt' | 'updatedAt' | 'heroEnabled'>
  & { heroEnabled?: boolean };
export type StoreUpdate = Partial<StoreInsert>;

export type StoreThemeInsert = Omit<StoreTheme, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreThemeUpdate = Partial<Omit<StoreThemeInsert, 'storeId'>>;

export type StorePoliciesInsert = Omit<StorePolicies, 'id' | 'createdAt' | 'updatedAt'>;
export type StorePoliciesUpdate = Partial<Omit<StorePoliciesInsert, 'storeId'>>;

export interface StoreHeroSlide {
  id: string;
  storeId: string;
  sortOrder: number;
  isActive: boolean;
  showTitle: boolean;
  showSubtitle: boolean;
  showCta: boolean;
  showMainImage: boolean;
  showBadgeImage: boolean;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  mainImageUrl: string | null;
  backgroundImageUrl: string | null;
  badgeImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreHeroSlideInsert = Omit<StoreHeroSlide, 'createdAt' | 'updatedAt'>;
export type StoreHeroSlideUpdate = Partial<Omit<StoreHeroSlideInsert, 'storeId'>>;

export interface StoreMember {
  id: string;
  storeId: string;
  userId: string;
  role: StoreMemberRole;
  status: StoreMemberStatus;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StoreMemberInsert = Omit<StoreMember, 'id' | 'createdAt' | 'updatedAt'>;
export type StoreMemberUpdate = Partial<Pick<StoreMember, 'role' | 'status'>>;

export interface StoreLimit {
  id: string;
  storeId: string;
  planKey: PlanKey;
  maxProducts: number;
  maxStaff: number;
  maxActiveOffers: number;
  maxMonthlyOrders: number | null;
  canUsePayments: boolean;
  canUseCustomDomain: boolean;
  canUseAdvancedTheme: boolean;
  createdAt: string;
  updatedAt: string;
}

export type StoreLimitUpdate = Partial<Omit<StoreLimit, 'id' | 'storeId' | 'createdAt' | 'updatedAt'>>;

export interface StoresState {
  items: Store[];
  current: Store | null;
  currentMembers: StoreMember[];
  currentLimits: StoreLimit | null;
  currentLocation: StoreLocation | null;
  currentBusinessHours: StoreBusinessHour[];
  currentCommerceSettings: StoreCommerceSettings | null;
  myMemberships: StoreMember[];
  status: AsyncStatus;
  error: string | null;
}

// ── Slug availability (check_store_slug_availability RPC) ───

export type SlugAvailabilityReason =
  | 'ok'
  | 'too_short'
  | 'too_long'
  | 'invalid_format'
  | 'all_numeric'
  | 'reserved'
  | 'taken';

export interface SlugAvailabilityResult {
  available: boolean;
  normalizedSlug: string;
  reason: SlugAvailabilityReason;
}

// ── Edge Function payload types ──────────────────────────────

export interface CreateStoreWithOwnerInput {
  // Owner
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerDocumentType: string | null;
  ownerDocumentNumber: string | null;
  // Store
  name: string;
  slug: string;
  slogan: string | null;
  businessVertical: BusinessVertical;
  businessSubcategory: string;
  description: string;
  logoUrl: string | null;
  supportEmail: string | null;
  whatsappNumber: string;
  country: string;
  city: string;
  currency: string;
  // Theme
  mode: ThemeMode;
  themePreset: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  // Location
  location: {
    addressLine: string | null;
    neighborhood: string | null;
    city: string | null;
    department: string | null;
    country: string;
    postalCode: string | null;
    isPublic: boolean;
  };
  // Business hours
  businessHours: Array<{
    dayOfWeek: number;
    isOpen: boolean;
    opensAt: string | null;
    closesAt: string | null;
    breakStartsAt: string | null;
    breakEndsAt: string | null;
  }>;
  // Policies
  policies: {
    shippingPolicy: string | null;
    returnsPolicy: string | null;
    warrantyPolicy: string | null;
    privacyPolicy: string | null;
    termsAndConditions: string | null;
  };
}

export interface CreateStoreWithOwnerResponse {
  storeId: string;
  storeSlug: string;
  ownerUserId: string;
  ownerIsNew: boolean;
}
