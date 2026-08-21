import type { ThemeMode, PublicCategoryExperience } from '@/types/common.types';

export interface StoreCategoryExperience extends PublicCategoryExperience {
  ownerId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreCategoryExperienceCreateInput {
  storeId: string;
  categoryId: string;
  displayName: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  themeMode: ThemeMode;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  buttonRadius: string;
  sortOrder?: number;
}

export type StoreCategoryExperienceUpdateInput = Partial<Omit<StoreCategoryExperienceCreateInput, 'storeId' | 'categoryId'>> & {
  categoryId?: string;
  isActive?: boolean;
};
