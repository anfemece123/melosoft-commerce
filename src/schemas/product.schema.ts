import * as Yup from 'yup';
import type { ProductType } from '@/types/common.types';

export type DiscountMode = 'none' | 'direct_price' | 'percentage' | 'fixed_amount';

export interface ProductFormValues {
  productType: ProductType;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  regularPrice: number | '';
  // Discount UX fields
  discountMode: DiscountMode;
  discountValue: number | '';  // helper: percentage (1-99) or fixed amount
  salePrice: number | '';      // the actual promotional price saved to DB
  sku: string;
  trackInventory: boolean;
  stockQuantity: number | '';
  status: 'draft' | 'active';
  isAvailable: boolean;
  isFeatured: boolean;
  preparationTimeMinutes: number | '';
  allowsSpecialInstructions: boolean;
  specialInstructionsLabel: string;
  specialInstructionsPlaceholder: string;
  specialInstructionsMaxLength: number | '';
}

export const productSchema = Yup.object({
  productType: Yup.string()
    .oneOf(['menu_item', 'physical_product', 'service'] as const)
    .required('El tipo es requerido'),
  name: Yup.string().required('El nombre es requerido'),
  slug: Yup.string()
    .matches(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones')
    .required('El slug es requerido'),
  description: Yup.string().required('La descripción es requerida'),
  shortDescription: Yup.string().max(160, 'Máximo 160 caracteres'),
  category: Yup.string(),
  regularPrice: Yup.number()
    .min(0, 'Debe ser mayor o igual a 0')
    .required('El precio es requerido'),
  discountMode: Yup.string()
    .oneOf(['none', 'direct_price', 'percentage', 'fixed_amount'] as const)
    .required(),
  salePrice: Yup.number()
    .min(0, 'El precio promocional debe ser mayor o igual a 0')
    .nullable()
    .optional()
    .test(
      'sale-price-less-than-regular',
      'El precio promocional debe ser menor al precio normal',
      function (value) {
        if (value === undefined || value === null) return true;
        const regularPrice = Number(this.parent.regularPrice);
        if (!regularPrice || regularPrice <= 0) return true;
        return value < regularPrice;
      }
    ),
  discountValue: Yup.number()
    .nullable()
    .optional()
    .test('discount-value-valid', 'Valor inválido', function (value) {
      const { discountMode, regularPrice } = this.parent as ProductFormValues;
      if (discountMode === 'none' || discountMode === 'direct_price') return true;
      if (value === undefined || value === null) {
        return this.createError({ message: 'El valor del descuento es requerido' });
      }
      if (discountMode === 'percentage') {
        if (value < 1) return this.createError({ message: 'El porcentaje mínimo es 1%' });
        if (value > 99) return this.createError({ message: 'El porcentaje máximo es 99%' });
      }
      if (discountMode === 'fixed_amount') {
        const rp = Number(regularPrice);
        if (rp > 0 && value >= rp) {
          return this.createError({ message: 'El descuento debe ser menor al precio normal' });
        }
      }
      return true;
    }),
  sku: Yup.string(),
  trackInventory: Yup.boolean().required(),
  stockQuantity: Yup.number()
    .integer('Debe ser entero')
    .min(0, 'Debe ser mayor o igual a 0')
    .nullable()
    .optional(),
  status: Yup.string().oneOf(['draft', 'active'] as const).required(),
  isAvailable: Yup.boolean().required(),
  isFeatured: Yup.boolean().required(),
  allowsSpecialInstructions: Yup.boolean().required(),
  specialInstructionsLabel: Yup.string().max(80, 'Máximo 80 caracteres'),
  specialInstructionsPlaceholder: Yup.string().max(140, 'Máximo 140 caracteres'),
  specialInstructionsMaxLength: Yup.number()
    .integer('Debe ser entero')
    .min(40, 'Mínimo 40 caracteres')
    .max(500, 'Máximo 500 caracteres')
    .nullable()
    .optional(),
  preparationTimeMinutes: Yup.number()
    .integer('Debe ser entero')
    .min(1, 'Mínimo 1 minuto')
    .nullable()
    .optional(),
});
