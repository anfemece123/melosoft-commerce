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

/** @deprecated Legacy field kept for DB compatibility. Use BusinessVertical instead. */
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

export type BusinessVertical =
  | 'food_restaurant'
  | 'retail_products'
  | 'catalog_quote'
  | 'real_estate';

export type OrderFlowType = 'restaurant' | 'ecommerce' | 'quote' | 'lead';

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
export type FulfillmentMethod = 'delivery' | 'pickup' | 'local_delivery' | 'national_shipping';
export type OrderSource = 'web' | 'whatsapp' | 'admin';
export type OrderPaymentMethod = 'cash_on_delivery' | 'online';

// Payments
export type PaymentEnvironment = 'sandbox' | 'production';
export type TransactionStatus = 'pending' | 'approved' | 'declined' | 'error' | 'voided' | 'refunded';

// Public header configuration
export type PublicHeaderStyle = 'classic' | 'search';
export type LogoSize = 'sm' | 'md' | 'lg';
export type MenuTextSize = 'sm' | 'md' | 'lg';
export type HeaderMenuMode = 'catalog_link' | 'categories';

export interface PublicHeaderSettings {
  style: PublicHeaderStyle;
  isSticky: boolean;
  transparentOnHero: boolean;
  showLogo: boolean;
  showStoreName: boolean;
  showHomeLink: boolean;
  logoSize: LogoSize;
  menuTextSize: MenuTextSize;
  menuMode: HeaderMenuMode;
}

export const DEFAULT_HEADER_SETTINGS: PublicHeaderSettings = {
  style: 'classic',
  isSticky: true,
  transparentOnHero: false,
  showLogo: true,
  showStoreName: true,
  showHomeLink: true,
  logoSize: 'md',
  menuTextSize: 'md',
  menuMode: 'catalog_link',
};

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
  localDeliveryBaseFee: number | null;
  localDeliveryFreeFrom: number | null;
  nationalShippingBaseFee: number | null;
  nationalShippingFreeFrom: number | null;
  headerSettings: PublicHeaderSettings | null;
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

export interface ProductDescriptionSection {
  id: string;
  title: string;
  icon: string;
  content: string;
  sortOrder: number;
  isVisible: boolean;
}

export interface ProductFacetValue {
  facetId: string;
  facetName: string;
  facetSlug: string;
  inputType: 'single_select' | 'multi_select';
  valueId: string;
  value: string;
  valueSlug: string;
}

export interface ProductCollectionAssignment {
  id: string;
  name: string;
  slug: string;
}

export interface PublicStoreCollection {
  id: string;
  storeId: string;
  storeSlug: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  color: string | null;
  sortOrder: number;
  showOnHome: boolean;
  showInMenu: boolean;
}

export interface PublicStoreFacetValue {
  id: string;
  storeId: string;
  facetId: string;
  value: string;
  slug: string;
  sortOrder: number;
  // Where this value comes from — a real per-product facet assignment, a
  // purchasable variant option value, or both (same normalized value exists
  // via each path). Absent/undefined means "attribute" (every value read
  // straight from the DB facet tables, pre-merge). Only set by
  // buildUnifiedPublicFacets in variantFilters.ts.
  sources?: ('attribute' | 'variant')[];
}

export interface FacetApplicableCategory {
  categoryId: string;
  appliesToChildren: boolean;
}

export interface PublicStoreFacet {
  id: string;
  storeId: string;
  storeSlug: string;
  name: string;
  slug: string;
  inputType: 'single_select' | 'multi_select';
  showInCatalogFilters: boolean;
  showInMegaMenu: boolean;
  appliesToAllCategories: boolean;
  applicableCategories: FacetApplicableCategory[];
  sortOrder: number;
  values: PublicStoreFacetValue[];
  // Informational only (not read by any matching/filtering logic): whether
  // this facet's values are purely attribute-sourced, purely variant-derived
  // (no colliding real facet existed), or a merge of both.
  source?: 'attribute' | 'variant' | 'mixed';
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
  trackInventory: boolean;
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
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryParentId: string | null;
  collections: ProductCollectionAssignment[];
  facetValues: ProductFacetValue[];
  whatsappCheckoutEnabled: boolean | null;
  webOrderEnabled: boolean | null;
  allowsPickup: boolean | null;
  allowsLocalDelivery: boolean | null;
  commerceMode: CommerceMode | null;
  catalogType: CatalogType | null;
  descriptionSections: ProductDescriptionSection[];
  hasVariants: boolean;
  // Per-product catalog display preference: split the controlsMedia option
  // (usually Color/Modelo) into one card per value (fashion/footwear style)
  // instead of a single grouped card. See buildCatalogItems.
  showVariantsAsCards: boolean;
  sizeChart: PublicSizeChart | null;
  variantOptions: PublicVariantOption[];
  variants: PublicProductVariant[];
  createdAt: string;
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

// A single selected modifier/adición — carried through cart → checkout →
// order. `optionGroupId`/`optionItemId` are what the client sends to the
// server (the only fields it's trusted to provide); `optionGroupName`/
// `optionItemLabel`/`priceDelta` are what the client shows locally for its
// own UI, but the server always re-resolves and re-prices them from
// product_option_groups/product_option_items — never trusts these values
// for the actual charge.
export interface SelectedProductOptionItem {
  optionGroupId: string;
  optionGroupName: string;
  optionItemId: string;
  optionItemLabel: string;
  priceDelta: number;
}

// Variants (talla/color/etc.) — separate from ProductFacetValue above,
// which describes general filterable attributes, not purchasable
// combinations with their own price/sku/stock.

export interface PublicVariantOptionValue {
  id: string;
  value: string;
  normalizedValue: string;
  colorHex: string | null;
  // Gallery attached to this specific value (e.g. all "Color: Verde"
  // photos) — reused by every variant of that color instead of the
  // owner having to re-upload it per size.
  images: PublicProductImage[];
}

export interface PublicVariantOption {
  id: string;
  name: string;
  type: 'size' | 'color' | 'material' | 'style' | 'custom';
  useAsPublicFilter: boolean;
  // True for at most the one option (usually Color/Modelo) whose
  // selected value's images should drive the product gallery — see
  // resolveVariantGalleryImages in productVariants.utils.ts.
  controlsMedia: boolean;
  sortOrder: number;
  values: PublicVariantOptionValue[];
}

export interface PublicProductVariantOptionValue {
  optionId: string;
  optionName: string;
  valueId: string;
  value: string;
}

export interface PublicProductVariant {
  id: string;
  sku: string | null;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number;
  stockPolicy: 'deny' | 'allow_backorder';
  isDefault: boolean;
  imageUrl: string | null;
  optionValues: PublicProductVariantOptionValue[];
}

export interface PublicSizeChart {
  id: string;
  name: string;
  chartType: 'shoes' | 'clothing' | 'custom';
  unit: 'cm' | 'in';
  content: Record<string, unknown>;
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

export interface PublicStoreCategory {
  id: string;
  storeId: string;
  storeSlug: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  imageUrl: string | null;
  color: string | null;
  sortOrder: number;
  showInMenu: boolean;
  children?: PublicStoreCategory[];
}

export interface CatalogMeta {
  categories: PublicStoreCategory[];
  categoryTree: PublicStoreCategory[];
  collections: PublicStoreCollection[];
  facets: PublicStoreFacet[];
  megaMenuFacets: PublicStoreFacet[];
  products?: PublicProductPage[];
  priceRange: { min: number; max: number };
}

// Home Builder — per-store ordered, togglable homepage sections.
// 'hero' is a position/visibility marker only; its content stays in
// stores.hero_enabled + store_hero_slides (edited from StoreSettingsPage).
// featured_collections/menu_highlights/benefits/gallery are Phase 2
// placeholders — already valid values, not yet offered in the admin
// "add section" picker (see PHASE1_SECTION_TYPES in homeSections.types.ts).
export type HomeSectionType =
  | 'hero'
  | 'promo_banners'
  | 'featured_products'
  | 'featured_categories'
  | 'testimonials'
  | 'image_text'
  | 'featured_collections'
  | 'menu_highlights'
  | 'benefits'
  | 'gallery'
  | 'catalog_products';

export interface PublicHomeSectionItem {
  id: string;
  sectionId: string;
  sortOrder: number;
  linkedEntityType: 'product' | 'category' | 'collection' | null;
  linkedEntityId: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
  rating: number | null;
  /** Type-specific per-item visual settings (currently only used by
   * promo_banners — see promoBanner.types.ts), decoded the same
   * defensive way `content` is on the parent section. */
  settings: Record<string, unknown> | null;
}

export interface PublicHomeSection {
  id: string;
  storeId: string;
  sectionType: HomeSectionType;
  sortOrder: number;
  heading: string | null;
  subheading: string | null;
  content: Record<string, unknown>;
  items: PublicHomeSectionItem[];
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
