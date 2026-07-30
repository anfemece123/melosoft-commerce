export type CartaTemplateKey = 'signature' | 'gallery' | 'minimal';
export type CartaNavigationMode = 'continuous' | 'paginated';
export type CartaCoverLayout = 'none' | 'single';
export type CartaCategoryHeadingAlignment = 'left' | 'center';
export type CartaProductImageMode = 'all' | 'first_per_category' | 'none';
export type CartaCategoryImagePosition = 'above_heading' | 'below_heading' | 'beside_left' | 'beside_right';
export type CartaCategoryImageSize = 'small' | 'medium' | 'large';

export interface CartaSettings {
  id: string;
  storeId: string;
  enabled: boolean;
  listedInStorefront: boolean;
  title: string | null;
  subtitle: string | null;
  templateKey: CartaTemplateKey;
  navigationMode: CartaNavigationMode;
  showCategoryDescriptions: boolean;
  categoryOrder: string[];
  productOrder: string[];
  coverLayout: CartaCoverLayout;
  coverProductIds: string[];
  coverImageUrl: string | null;
  coverBackgroundImageUrl: string | null;
  showLogo: boolean;
  showProductDescriptions: boolean;
  categoryHeadingAlignment: CartaCategoryHeadingAlignment;
  productImageMode: CartaProductImageMode;
  categoryImageSelections: Record<string, string>;
  categoryImagePositions: Record<string, CartaCategoryImagePosition>;
  categoryImageSizes: Record<string, CartaCategoryImageSize>;
  createdAt: string;
  updatedAt: string;
}

export type CartaSettingsInsert = Omit<CartaSettings, 'id' | 'createdAt' | 'updatedAt'>;
export type CartaSettingsUpdate = Partial<Omit<CartaSettingsInsert, 'storeId'>>;

export interface PublicCartaProduct {
  id: string;
  name: string;
  shortDescription: string | null;
  imageUrl: string | null;
  price: number;
  sortOrder: number;
}

export interface PublicCartaCategory {
  id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  products: PublicCartaProduct[];
}

export interface PublicCartaPage {
  storeName: string;
  logoUrl: string | null;
  currency: string;
  title: string | null;
  subtitle: string | null;
  templateKey: CartaTemplateKey;
  navigationMode: CartaNavigationMode;
  showCategoryDescriptions: boolean;
  coverLayout: CartaCoverLayout;
  coverProductIds: string[];
  coverImageUrl: string | null;
  coverBackgroundImageUrl: string | null;
  showLogo: boolean;
  showProductDescriptions: boolean;
  categoryHeadingAlignment: CartaCategoryHeadingAlignment;
  productImageMode: CartaProductImageMode;
  categoryImageSelections: Record<string, string>;
  categoryImagePositions: Record<string, CartaCategoryImagePosition>;
  categoryImageSizes: Record<string, CartaCategoryImageSize>;
  themeMode: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  buttonRadius: string | null;
  categories: PublicCartaCategory[];
}
