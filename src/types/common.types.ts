export type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface ApiError {
  message: string;
  code?: string;
}

// Roles and membership
export type PlatformRole = 'platform_admin' | 'platform_member';
export type UserStatus = 'active' | 'inactive';
export type StoreMemberRole = 'owner' | 'admin' | 'staff' | 'viewer';
export type StoreMemberStatus = 'active' | 'inactive';
export type PlanKey = 'basic' | 'pro' | 'premium' | 'custom';

// Store
export type StoreStatus = 'active' | 'inactive' | 'suspended' | 'archived';
export type BusinessType =
  | 'barberia'
  | 'restaurante'
  | 'moda'
  | 'tecnologia'
  | 'mascotas'
  | 'hogar'
  | 'belleza'
  | 'salud'
  | 'otro';

// Commerce settings
export type BusinessCategory =
  | 'restaurant'
  | 'retail'
  | 'fashion'
  | 'beauty'
  | 'technology'
  | 'pets'
  | 'home'
  | 'services'
  | 'other';

export type CatalogType = 'menu' | 'physical_products' | 'services' | 'mixed';

export type CommerceMode =
  | 'catalog_only'
  | 'local_orders'
  | 'local_delivery_and_pickup'
  | 'national_shipping'
  | 'mixed';

export type DeliveryMode =
  | 'none'
  | 'pickup_only'
  | 'local_delivery'
  | 'national_shipping'
  | 'local_and_national';

export type OrderMethod = 'whatsapp' | 'web_order' | 'online_checkout';
export type ThemePreset =
  | 'blue'
  | 'violet'
  | 'emerald'
  | 'rose'
  | 'amber'
  | 'slate'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'indigo'
  | 'fuchsia'
  | 'pink';
export type ThemeMode = 'light' | 'dark';
export type TemplateKey = 'default';

// Products
export type ProductType = 'menu_item' | 'physical_product' | 'service';
export type ProductStatus = 'draft' | 'active' | 'inactive' | 'archived';
export type ProductOptionSelectionType = 'single' | 'multiple';

// Offers
export type OfferStatus = 'draft' | 'active' | 'paused' | 'expired' | 'sold_out' | 'archived';
export type CountdownMode = 'fixed_window' | 'per_visitor';

// Orders
export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type FulfillmentMethod = 'delivery' | 'pickup';
export type OrderSource = 'web' | 'whatsapp' | 'admin';
export type OrderPaymentMethod = 'cash_on_delivery' | 'online';

// Payments
export type PaymentEnvironment = 'sandbox' | 'production';
export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';

// Public view shapes (camelCase, used by public pages)

export interface PublicStorePage {
  storeId: string;
  storeSlug: string;
  storeName: string;
  slogan: string | null;
  businessType: string | null;
  description: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  heroEnabled: boolean | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaLabel: string | null;
  heroImageUrl: string | null;
  heroBackgroundImageUrl: string | null;
  whatsappNumber: string | null;
  supportEmail: string | null;
  country: string;
  city: string | null;
  currency: string;
  themeMode: ThemeMode | null;
  themePreset: ThemePreset | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonRadius: string | null;
  templateKey: TemplateKey | null;
  shippingPolicy: string | null;
  returnsPolicy: string | null;
  warrantyPolicy: string | null;
  privacyPolicy: string | null;
  termsAndConditions: string | null;
  locationAddress: string | null;
  locationNeighborhood: string | null;
  locationCity: string | null;
  locationDepartment: string | null;
  locationCountry: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  catalogType: CatalogType | null;
  businessCategory: string | null;
  commerceMode: CommerceMode | null;
  deliveryMode: DeliveryMode | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  allowsNationalShipping: boolean | null;
  whatsappCheckoutEnabled: boolean | null;
  webOrderEnabled: boolean | null;
  cashOnDeliveryEnabled: boolean | null;
  onlineCheckoutEnabled: boolean | null;
  defaultOrderMethod: OrderMethod | null;
  localDeliveryNotes: string | null;
  shippingNotes: string | null;
}

export interface PublicStoreHeroSlide {
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
}

export interface PublicProductPage {
  storeSlug: string;
  storeName: string;
  storeWhatsappNumber: string | null;
  logoUrl: string | null;
  themeMode: ThemeMode | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonRadius: string | null;
  templateKey: TemplateKey | null;
  productId: string;
  productSlug: string;
  productName: string;
  description: string;
  shortDescription: string | null;
  productType: ProductType;
  regularPrice: number;
  compareAtPrice: number | null;
  salePrice: number | null;
  stock: number;
  isFeatured: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number | null;
  allowsSpecialInstructions: boolean;
  specialInstructionsLabel: string | null;
  specialInstructionsPlaceholder: string | null;
  specialInstructionsMaxLength: number;
  mainImageUrl: string | null;
  images: PublicProductImage[];
  optionGroups: PublicProductOptionGroup[];
  category: string | null;
  whatsappCheckoutEnabled: boolean | null;
  webOrderEnabled: boolean | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  commerceMode: CommerceMode | null;
  catalogType: CatalogType | null;
}

export interface PublicProductImage {
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
}

export interface PublicProductOptionGroup {
  id: string;
  name: string;
  description: string | null;
  selectionType: ProductOptionSelectionType;
  minSelect: number;
  maxSelect: number | null;
  isRequired: boolean;
  sortOrder: number;
  items: PublicProductOptionItem[];
}

export interface PublicProductOptionItem {
  id: string;
  label: string;
  description: string | null;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface PublicOfferPage {
  storeSlug: string;
  storeName: string;
  storeWhatsappNumber: string | null;
  logoUrl: string | null;
  themeMode: ThemeMode | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonRadius: string | null;
  templateKey: TemplateKey | null;
  offerId: string;
  offerSlug: string;
  title: string;
  subtitle: string | null;
  description: string;
  regularPrice: number;
  offerPrice: number;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  countdownMode: CountdownMode;
  showCountdown: boolean;
  isVisibleInStore: boolean;
  sortOrder: number;
  status: OfferStatus;
  offerWhatsappNumber: string | null;
  whatsappMessage: string | null;
  ctaLabel: string;
  heroImageUrl: string | null;
  termsAndConditions: string | null;
  productName: string | null;
  productSlug: string | null;
  productMainImageUrl: string | null;
}

export interface StoreCampaignOffer {
  id: string;
  storeId: string;
  storeSlug: string;
  offerSlug: string;
  title: string;
  subtitle: string | null;
  offerPrice: number;
  regularPrice: number;
  countdownMode: CountdownMode;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number | null;
  showCountdown: boolean;
  sortOrder: number;
  heroImageUrl: string | null;
  productName: string | null;
  productSlug: string | null;
  productMainImageUrl: string | null;
}

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
}

export interface CampaignOfferSession {
  id: string;
  offerId: string;
  visitorToken: string;
  firstSeenAt: string;
  expiresAt: string;
  claimCode: string;
  createdAt: string;
  updatedAt: string;
}
