import type {
  ExperienceBackgroundPattern,
  ExperienceBackgroundStyle,
  ExperienceGatewayPlacement,
  ExperienceHeadingFont,
  PublicCategoryExperience,
  ThemeMode,
} from '@/types/common.types';

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
  tagline?: string | null;
  backgroundStyle: ExperienceBackgroundStyle;
  backgroundPattern: ExperienceBackgroundPattern;
  backgroundImageUrl?: string | null;
  backgroundIntensity: number;
  headingFont: ExperienceHeadingFont;
  sortOrder?: number;
}

export type StoreCategoryExperienceUpdateInput = Partial<Omit<StoreCategoryExperienceCreateInput, 'storeId' | 'categoryId'>> & {
  categoryId?: string;
  isActive?: boolean;
};

export interface StoreExperienceGateway {
  storeId: string;
  isEnabled: boolean;
  placement: ExperienceGatewayPlacement;
  title: string | null;
  subtitle: string | null;
}

export type StoreExperienceGatewayInput = Omit<StoreExperienceGateway, 'storeId'>;
