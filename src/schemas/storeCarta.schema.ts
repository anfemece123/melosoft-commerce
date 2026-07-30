import * as Yup from 'yup';

export const storeCartaSchema = Yup.object({
  enabled: Yup.boolean().required(),
  listedInStorefront: Yup.boolean().required(),
  title: Yup.string().trim().max(80, 'Máximo 80 caracteres').nullable(),
  subtitle: Yup.string().trim().max(160, 'Máximo 160 caracteres').nullable(),
  templateKey: Yup.string().oneOf(['signature', 'gallery', 'minimal']).required(),
  navigationMode: Yup.string().oneOf(['continuous', 'paginated']).required(),
  showCategoryDescriptions: Yup.boolean().required(),
  coverLayout: Yup.string().oneOf(['none', 'single']).required(),
  coverProductIds: Yup.array().of(Yup.string().required()).max(1, 'Selecciona máximo una imagen').required(),
  coverImageUrl: Yup.string().url('La imagen de portada no es válida').nullable(),
  coverBackgroundImageUrl: Yup.string().url('El fondo de portada no es válido').nullable(),
  showLogo: Yup.boolean().required(),
  showProductDescriptions: Yup.boolean().required(),
  categoryHeadingAlignment: Yup.string().oneOf(['left', 'center']).required(),
  productImageMode: Yup.string().oneOf(['all', 'first_per_category', 'none']).required(),
  categoryImageModes: Yup.object().required(),
  categoryImageSelections: Yup.object().required(),
  categoryImagePositions: Yup.object().required(),
  categoryImageSizes: Yup.object().required(),
  productImagePositions: Yup.object().required(),
});

export interface StoreCartaFormValues {
  enabled: boolean;
  listedInStorefront: boolean;
  title: string;
  subtitle: string;
  templateKey: 'signature' | 'gallery' | 'minimal';
  navigationMode: 'continuous' | 'paginated';
  showCategoryDescriptions: boolean;
  coverLayout: 'none' | 'single';
  coverProductIds: string[];
  coverImageUrl: string | null;
  coverBackgroundImageUrl: string | null;
  showLogo: boolean;
  showProductDescriptions: boolean;
  categoryHeadingAlignment: 'left' | 'center';
  productImageMode: 'all' | 'first_per_category' | 'none';
  categoryImageModes: Record<string, 'all' | 'first_per_category' | 'none'>;
  categoryImageSelections: Record<string, string>;
  categoryImagePositions: Record<string, 'above_heading' | 'below_heading' | 'beside_left' | 'beside_right'>;
  categoryImageSizes: Record<string, 'small' | 'medium' | 'large'>;
  productImagePositions: Record<string, 'left' | 'right'>;
}
