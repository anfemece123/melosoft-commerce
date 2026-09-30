import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceGatewayPlacement,
  ExperienceHeadingFont,
  PublicCategoryExperience,
  PublicExperienceGateway,
} from '@/types/common.types';
import type {
  PublicStoreCategoryExperienceRow,
  PublicStoreExperienceGatewayRow,
  StoreExperienceGatewayRow,
  StoreCategoryExperienceRow,
  StoreCategoryExperienceRowInsert,
  StoreCategoryExperienceRowUpdate,
} from '@/types/database.types';
import type {
  StoreCategoryExperience,
  StoreCategoryExperienceCreateInput,
  StoreCategoryExperienceUpdateInput,
  StoreExperienceGateway,
} from './categoryExperiences.types';

const BACKGROUND_STYLES: readonly ExperienceBackgroundStyle[] = ['solid', 'gradient', 'pattern', 'image'];
const BACKGROUND_PATTERNS: readonly ExperienceBackgroundPattern[] = ['dots', 'grid', 'tablecloth', 'diagonal', 'waves', 'terrazzo'];
const HEADING_FONTS: readonly ExperienceHeadingFont[] = ['default', 'elegant', 'classic', 'modern', 'bold', 'rustic', 'handwritten'];

function pick<T extends string>(value: string | null | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.find((item) => item === value) ?? fallback;
}

function toPlacement(value: string | null | undefined): ExperienceGatewayPlacement {
  return value === 'below_hero' ? 'below_hero' : 'replace_hero';
}

function clampIntensity(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function mapPublicRow(row: PublicStoreCategoryExperienceRow): PublicCategoryExperience {
  return {
    id: row.id,
    storeId: row.store_id,
    storeSlug: row.store_slug,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categorySlug: row.category_slug,
    displayName: row.display_name,
    description: row.description,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    themeMode: row.theme_mode === 'dark' ? 'dark' : 'light',
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    buttonRadius: row.button_radius,
    tagline: row.tagline,
    backgroundStyle: pick(row.background_style, BACKGROUND_STYLES, 'solid'),
    backgroundPattern: pick(row.background_pattern, BACKGROUND_PATTERNS, 'dots'),
    backgroundImageUrl: row.background_image_url,
    backgroundIntensity: clampIntensity(row.background_intensity),
    headingFont: pick(row.heading_font, HEADING_FONTS, 'default'),
    sortOrder: row.sort_order,
  };
}

export function mapStoreCategoryExperienceRowToExperience(row: StoreCategoryExperienceRow): StoreCategoryExperience {
  return {
    ...mapPublicRow({
      id: row.id,
      store_id: row.store_id,
      store_slug: '',
      category_id: row.category_id,
      category_name: '',
      category_slug: '',
      display_name: row.display_name,
      description: row.description,
      logo_url: row.logo_url,
      cover_image_url: row.cover_image_url,
      theme_mode: row.theme_mode,
      primary_color: row.primary_color,
      secondary_color: row.secondary_color,
      accent_color: row.accent_color,
      background_color: row.background_color,
      text_color: row.text_color,
      button_radius: row.button_radius,
      tagline: row.tagline,
      background_style: row.background_style,
      background_pattern: row.background_pattern,
      background_image_url: row.background_image_url,
      background_intensity: row.background_intensity,
      heading_font: row.heading_font,
      sort_order: row.sort_order,
    }),
    ownerId: row.owner_id,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapExperienceInsertToRow(
  input: StoreCategoryExperienceCreateInput,
  ownerId: string,
): StoreCategoryExperienceRowInsert {
  return {
    store_id: input.storeId,
    category_id: input.categoryId,
    owner_id: ownerId,
    display_name: input.displayName.trim(),
    description: input.description?.trim() || null,
    logo_url: input.logoUrl ?? null,
    cover_image_url: input.coverImageUrl ?? null,
    theme_mode: input.themeMode,
    primary_color: input.primaryColor,
    secondary_color: input.secondaryColor,
    accent_color: input.accentColor,
    background_color: input.backgroundColor,
    text_color: input.textColor,
    button_radius: input.buttonRadius,
    tagline: input.tagline?.trim() || null,
    background_style: input.backgroundStyle,
    background_pattern: input.backgroundPattern,
    background_image_url: input.backgroundImageUrl ?? null,
    background_intensity: clampIntensity(input.backgroundIntensity),
    heading_font: input.headingFont,
    sort_order: input.sortOrder ?? 0,
  };
}

export function mapExperienceUpdateToRow(input: StoreCategoryExperienceUpdateInput): StoreCategoryExperienceRowUpdate {
  const row: StoreCategoryExperienceRowUpdate = {};
  if (input.categoryId !== undefined) row.category_id = input.categoryId;
  if (input.displayName !== undefined) row.display_name = input.displayName.trim();
  if (input.description !== undefined) row.description = input.description?.trim() || null;
  if (input.logoUrl !== undefined) row.logo_url = input.logoUrl ?? null;
  if (input.coverImageUrl !== undefined) row.cover_image_url = input.coverImageUrl ?? null;
  if (input.themeMode !== undefined) row.theme_mode = input.themeMode;
  if (input.primaryColor !== undefined) row.primary_color = input.primaryColor;
  if (input.secondaryColor !== undefined) row.secondary_color = input.secondaryColor;
  if (input.accentColor !== undefined) row.accent_color = input.accentColor;
  if (input.backgroundColor !== undefined) row.background_color = input.backgroundColor;
  if (input.textColor !== undefined) row.text_color = input.textColor;
  if (input.buttonRadius !== undefined) row.button_radius = input.buttonRadius;
  if (input.tagline !== undefined) row.tagline = input.tagline?.trim() || null;
  if (input.backgroundStyle !== undefined) row.background_style = input.backgroundStyle;
  if (input.backgroundPattern !== undefined) row.background_pattern = input.backgroundPattern;
  if (input.backgroundImageUrl !== undefined) row.background_image_url = input.backgroundImageUrl ?? null;
  if (input.backgroundIntensity !== undefined) row.background_intensity = clampIntensity(input.backgroundIntensity);
  if (input.headingFont !== undefined) row.heading_font = input.headingFont;
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  return row;
}

export function mapPublicCategoryExperienceRow(row: PublicStoreCategoryExperienceRow): PublicCategoryExperience {
  return mapPublicRow(row);
}

export function mapStoreExperienceGatewayRow(row: StoreExperienceGatewayRow): StoreExperienceGateway {
  return {
    storeId: row.store_id,
    isEnabled: row.is_enabled,
    placement: toPlacement(row.placement),
    title: row.title,
    subtitle: row.subtitle,
  };
}

export function mapPublicExperienceGatewayRow(row: PublicStoreExperienceGatewayRow): PublicExperienceGateway {
  return {
    storeId: row.store_id,
    placement: toPlacement(row.placement),
    title: row.title,
    subtitle: row.subtitle,
  };
}
