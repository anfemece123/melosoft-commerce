import type { PublicCategoryExperience } from '@/types/common.types';
import type {
  PublicStoreCategoryExperienceRow,
  StoreCategoryExperienceRow,
  StoreCategoryExperienceRowInsert,
  StoreCategoryExperienceRowUpdate,
} from '@/types/database.types';
import type {
  StoreCategoryExperience,
  StoreCategoryExperienceCreateInput,
  StoreCategoryExperienceUpdateInput,
} from './categoryExperiences.types';

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
  if (input.sortOrder !== undefined) row.sort_order = input.sortOrder;
  if (input.isActive !== undefined) row.is_active = input.isActive;
  return row;
}

export function mapPublicCategoryExperienceRow(row: PublicStoreCategoryExperienceRow): PublicCategoryExperience {
  return mapPublicRow(row);
}
