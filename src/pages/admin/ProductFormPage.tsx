import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import { ArrowLeft, Upload, X, Clock, Package, UtensilsCrossed, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { FormErrorAlert } from '@/components/ui/FormErrorAlert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DiscountBadge } from '@/components/ui/DiscountBadge';
import { ImageCropDialog } from '@/components/admin/ImageCropDialog';
import { ProductCategoryField } from '@/components/admin/ProductCategoryField';
import { ProductOptionsEditor } from '@/components/admin/ProductOptionsEditor';
import { useAppSelector } from '@/app/hooks';
import { productOptionsService, type ProductOptionGroupDraft } from '@/features/products/productOptionsService';
import { productsService } from '@/features/products/productsService';
import { locationsService } from '@/features/locations/locationsService';
import { productAvailabilityService } from '@/features/products/productAvailabilityService';
import type { StoreLocation } from '@/features/locations/locations.types';
import { slugify } from '@/utils/slugify';
import { formatCurrency } from '@/utils/formatCurrency';
import {
  calculateDiscountPercentage,
  calculateDiscountAmount,
  calculateSalePriceFromPercentage,
  calculateSalePriceFromFixedAmount,
} from '@/lib/pricing/pricing.utils';
import { productSchema } from '@/schemas/product.schema';
import type { DiscountMode, ProductFormValues } from '@/schemas/product.schema';
import { notify } from '@/lib/notifications';
import { mapSupabaseError } from '@/lib/errors/supabaseErrorMapper';
import type { ProductImage } from '@/features/products/products.types';
import { IMAGE_ASSET_PRESETS } from '@/lib/images/imageAssetPresets';
import { type LoadedImageFile, validateImageFile } from '@/lib/images/imageFile.utils';

const MAX_IMAGES = 5;

const DISCOUNT_MODES: { value: DiscountMode; label: string }[] = [
  { value: 'none', label: 'Sin descuento' },
  { value: 'direct_price', label: 'Precio promocional' },
  { value: 'percentage', label: '% Descuento' },
  { value: 'fixed_amount', label: 'Valor fijo' },
];

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0',
          checked ? 'bg-indigo-600' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </div>
  );
}

export function ProductFormPage() {
  const { storeId, productId } = useParams<{ storeId: string; productId: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(productId);
  const slugEditedByUser = useRef(false);

  const store = useAppSelector((s) => s.stores.current);
  const currentCommerceSettings = useAppSelector((s) => s.stores.currentCommerceSettings);
  const isMenu = currentCommerceSettings?.catalogType === 'menu';

  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);
  const [confirmDeleteImage, setConfirmDeleteImage] = useState<ProductImage | null>(null);
  const [cropQueue, setCropQueue] = useState<LoadedImageFile[]>([]);
  const [activeCrop, setActiveCrop] = useState<LoadedImageFile | null>(null);
  const [optionGroups, setOptionGroups] = useState<ProductOptionGroupDraft[]>([]);
  const [activeLocations, setActiveLocations] = useState<StoreLocation[]>([]);
  const [locationAvailability, setLocationAvailability] = useState<Record<string, boolean>>({});

  const defaultProductType = isMenu ? 'menu_item' : 'physical_product';
  const entitySingular = isMenu ? 'plato' : 'producto';
  const currency = store?.currency ?? 'COP';

  const formik = useFormik<ProductFormValues>({
    initialValues: {
      productType: defaultProductType,
      name: '',
      slug: '',
      description: '',
      shortDescription: '',
      category: '',
      regularPrice: '',
      discountMode: 'none',
      discountValue: '',
      salePrice: '',
      sku: '',
      trackInventory: true,
      stockQuantity: '',
      status: 'draft',
      isAvailable: true,
      isFeatured: false,
      preparationTimeMinutes: '',
      allowsSpecialInstructions: true,
      specialInstructionsLabel: 'Indicaciones para tu pedido',
      specialInstructionsPlaceholder: 'Ej: sin cebolla, salsa aparte, término medio',
      specialInstructionsMaxLength: 180,
    },
    validationSchema: productSchema,
    onSubmit: async (values, { setStatus }) => {
      if (!storeId) return;
      try {
        // Resolve the final sale price from discount mode
        const regularPriceNum = Number(values.regularPrice);
        let finalSalePrice: number | null = null;

        if (values.discountMode === 'direct_price' && values.salePrice !== '') {
          finalSalePrice = Number(values.salePrice);
        } else if (values.discountMode === 'percentage' && values.discountValue !== '') {
          finalSalePrice = calculateSalePriceFromPercentage(regularPriceNum, Number(values.discountValue));
        } else if (values.discountMode === 'fixed_amount' && values.discountValue !== '') {
          finalSalePrice = calculateSalePriceFromFixedAmount(regularPriceNum, Number(values.discountValue));
        }

        // Guard: sale price must be strictly less than regular price
        if (finalSalePrice !== null && (finalSalePrice < 0 || finalSalePrice >= regularPriceNum)) {
          finalSalePrice = null;
        }

        const payload = {
          storeId,
          productType: values.productType,
          name: values.name,
          slug: values.slug,
          description: values.description,
          shortDescription: values.shortDescription || null,
          category: values.category || null,
          regularPrice: regularPriceNum,
          salePrice: finalSalePrice,
          compareAtPrice: null,
          costPrice: null,
          stock: values.stockQuantity !== '' ? Number(values.stockQuantity) : 0,
          sku: values.sku || null,
          trackInventory: values.trackInventory,
          isFeatured: values.isFeatured,
          isAvailable: values.isAvailable,
          preparationTimeMinutes:
            values.preparationTimeMinutes !== '' ? Number(values.preparationTimeMinutes) : null,
          allowsSpecialInstructions: values.allowsSpecialInstructions,
          specialInstructionsLabel: values.specialInstructionsLabel || null,
          specialInstructionsPlaceholder: values.specialInstructionsPlaceholder || null,
          specialInstructionsMaxLength: Number(values.specialInstructionsMaxLength || 180),
          sortOrder: 0,
          status: values.status,
          mainImageUrl: null,
        };

        const saved = isEditing && productId
          ? await productsService.updateProduct(productId, payload)
          : await productsService.createProduct(payload);

        // Upload pending images sequentially so errors are per-file
        let firstUploadedUrl: string | null = null;
        for (let i = 0; i < pendingFiles.length; i++) {
          try {
            const img = await productsService.uploadProductImage(
              storeId,
              saved.id,
              pendingFiles[i],
              existingImages.length + i,
              existingImages.length === 0 && i === 0
            );
            if (i === 0 && existingImages.length === 0) firstUploadedUrl = img.imageUrl;
          } catch (imgErr) {
            notify.error(
              `No se pudo subir "${pendingFiles[i].name}": ${mapSupabaseError(imgErr)}`
            );
          }
        }

        if (!isEditing && firstUploadedUrl) {
          await productsService.updateProduct(saved.id, { mainImageUrl: firstUploadedUrl });
        }

        await productOptionsService.replaceProductOptionGroups(storeId, saved.id, optionGroups);

        // Save per-location availability
        for (const loc of activeLocations) {
          const isAvailable = locationAvailability[loc.id] ?? true;
          await productAvailabilityService.upsertAvailability(storeId, saved.id, loc.id, isAvailable);
        }

        const label = entitySingular.charAt(0).toUpperCase() + entitySingular.slice(1);
        notify.success(
          isEditing
            ? `${label} actualizado correctamente.`
            : `${label} creado correctamente.`
        );

        void navigate(`/admin/stores/${storeId}/products`);
      } catch (err) {
        const msg = mapSupabaseError(err);
        setStatus(msg);
        notify.error(msg);
      }
    },
  });

  // Compute discount preview from current form values
  const discountPreview = useMemo(() => {
    const rp = Number(formik.values.regularPrice);
    const sp = Number(formik.values.salePrice);
    if (!rp || !sp || sp <= 0 || sp >= rp) return null;
    return {
      regular: rp,
      sale: sp,
      pct: calculateDiscountPercentage(rp, sp),
      savings: calculateDiscountAmount(rp, sp),
    };
  }, [formik.values.regularPrice, formik.values.salePrice]);

  // Load product for editing
  useEffect(() => {
    if (!productId) return;
    async function load() {
      if (!productId) return;
      const [product, images] = await Promise.all([
        productsService.getProductById(productId),
        productsService.getProductImages(productId),
      ]);
      const optionGroupsData = await productOptionsService.getProductOptionGroups(productId);
      if (product) {
        slugEditedByUser.current = true;
        void formik.setValues({
          productType: product.productType,
          name: product.name,
          slug: product.slug,
          description: product.description,
          shortDescription: product.shortDescription ?? '',
          category: product.category ?? '',
          regularPrice: product.regularPrice,
          discountMode: product.salePrice !== null ? 'direct_price' : 'none',
          discountValue: '',
          salePrice: product.salePrice ?? '',
          sku: product.sku ?? '',
          trackInventory: product.trackInventory,
          stockQuantity: product.stock,
          status: product.status === 'archived' ? 'active' : (product.status as 'draft' | 'active'),
          isAvailable: product.isAvailable,
          isFeatured: product.isFeatured,
          preparationTimeMinutes: product.preparationTimeMinutes ?? '',
          allowsSpecialInstructions: product.allowsSpecialInstructions,
          specialInstructionsLabel: product.specialInstructionsLabel ?? 'Indicaciones para tu pedido',
          specialInstructionsPlaceholder: product.specialInstructionsPlaceholder ?? 'Ej: sin cebolla, salsa aparte, término medio',
          specialInstructionsMaxLength: product.specialInstructionsMaxLength ?? 180,
        });
        setExistingImages(images);
        setOptionGroups(optionGroupsData.map((group) => ({
          id: group.id,
          name: group.name,
          description: group.description,
          selectionType: group.selectionType,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          isActive: group.isActive,
          items: group.items.map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description,
            priceDelta: item.priceDelta,
            isDefault: item.isDefault,
            isActive: item.isActive,
          })),
        })));
      }
      setLoadingProduct(false);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    if (activeCrop || cropQueue.length === 0) return;
    const [next, ...rest] = cropQueue;
    setActiveCrop(next);
    setCropQueue(rest);
  }, [activeCrop, cropQueue]);

  useEffect(() => {
    if (!storeId) return;
    locationsService.getStoreLocations(storeId)
      .then(locs => setActiveLocations(locs.filter(l => l.isActive)))
      .catch(() => { /* silent */ });
  }, [storeId]);

  useEffect(() => {
    if (!productId) return;
    productAvailabilityService.getProductAvailability(productId)
      .then(map => setLocationAvailability(map))
      .catch(() => { /* silent */ });
  }, [productId]);

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.handleChange(e);
    if (!slugEditedByUser.current) {
      void formik.setFieldValue('slug', slugify(e.target.value));
    }
  }

  function handleSlugChange(e: React.ChangeEvent<HTMLInputElement>) {
    slugEditedByUser.current = true;
    formik.handleChange(e);
  }

  function handleDiscountModeChange(mode: DiscountMode) {
    void formik.setFieldValue('discountMode', mode);
    void formik.setFieldValue('discountValue', '');
    void formik.setFieldValue('salePrice', '');
  }

  function handleDiscountValueChange(e: React.ChangeEvent<HTMLInputElement>) {
    formik.handleChange(e);
    const val = Number(e.target.value);
    const rp = Number(formik.values.regularPrice);
    if (!val || !rp) return;

    if (formik.values.discountMode === 'percentage' && val >= 1 && val <= 99) {
      void formik.setFieldValue('salePrice', calculateSalePriceFromPercentage(rp, val));
    } else if (formik.values.discountMode === 'fixed_amount' && val > 0 && val < rp) {
      void formik.setFieldValue('salePrice', calculateSalePriceFromFixedAmount(rp, val));
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const total = existingImages.length + pendingFiles.length + files.length;
    const allowed = files.slice(0, MAX_IMAGES - existingImages.length - pendingFiles.length);
    if (total > MAX_IMAGES) {
      notify.warning(`Solo puedes subir hasta ${MAX_IMAGES} imágenes por ${entitySingular}.`);
    }

    const prepared: LoadedImageFile[] = [];
    for (const file of allowed) {
      try {
        const loaded = await validateImageFile(file, 'product_image');
        prepared.push(loaded);
      } catch (err) {
        notify.error(`${file.name}: ${mapSupabaseError(err)}`);
      }
    }

    if (prepared.length > 0) {
      setCropQueue((prev) => [...prev, ...prepared]);
    }

    e.target.value = '';
  }

  function removePendingFile(index: number) {
    URL.revokeObjectURL(pendingPreviews[index]);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function appendPendingFile(file: File) {
    const preview = URL.createObjectURL(file);
    setPendingFiles((prev) => [...prev, file]);
    setPendingPreviews((prev) => [...prev, preview]);
    setActiveCrop(null);
  }

  async function handleDeleteExistingConfirmed(image: ProductImage) {
    setDeletingImageId(image.id);
    setConfirmDeleteImage(null);
    try {
      await productsService.deleteProductImage(image.id, image.storagePath);
      setExistingImages((prev) => prev.filter((img) => img.id !== image.id));
      notify.success('Imagen eliminada.');
    } catch (err) {
      notify.fromError(err);
    } finally {
      setDeletingImageId(null);
    }
  }

  const totalImages = existingImages.length + pendingFiles.length;

  if (loadingProduct) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          to={`/admin/stores/${storeId}/products`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a {isMenu ? 'menú' : 'productos'}
        </Link>
      </div>

      <PageHeader
        title={isEditing ? `Editar ${entitySingular}` : `Nuevo ${entitySingular}`}
        description={
          isEditing
            ? `Modifica los datos de este ${entitySingular}.`
            : `Completa el formulario para crear un ${entitySingular}.`
        }
      />

      <form onSubmit={formik.handleSubmit} noValidate className="space-y-6 max-w-2xl">
        {/* Basic info */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {isMenu
                ? <UtensilsCrossed className="w-4 h-4 text-amber-600" />
                : <Package className="w-4 h-4 text-violet-600" />}
              Información básica
            </h3>
            <div className="space-y-4">
              {/* Product type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
                <div className="flex gap-2 flex-wrap">
                  {(isMenu
                    ? [{ value: 'menu_item', label: 'Plato / Ítem de menú' }]
                    : [
                        { value: 'physical_product', label: 'Producto físico' },
                        { value: 'service', label: 'Servicio' },
                      ]
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void formik.setFieldValue('productType', value)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        formik.values.productType === value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                id="name"
                label="Nombre"
                placeholder={isMenu ? 'Ej: Bandeja paisa' : 'Ej: Camisa de algodón'}
                {...formik.getFieldProps('name')}
                onChange={handleNameChange}
                error={formik.touched.name ? formik.errors.name : undefined}
              />

              <Input
                id="slug"
                label="URL del producto (slug)"
                placeholder="bandeja-paisa"
                hint="/p/bandeja-paisa"
                {...formik.getFieldProps('slug')}
                onChange={handleSlugChange}
                error={formik.touched.slug ? formik.errors.slug : undefined}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  rows={4}
                  placeholder="Descripción completa del producto..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  {...formik.getFieldProps('description')}
                />
                {formik.touched.description && formik.errors.description && (
                  <p className="mt-1 text-xs text-red-600">{formik.errors.description}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción corta
                  <span className="text-gray-400 font-normal ml-1">(máx. 160 caracteres)</span>
                </label>
                <textarea
                  id="shortDescription"
                  rows={2}
                  placeholder="Resumen breve para mostrar en tarjetas..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  {...formik.getFieldProps('shortDescription')}
                />
                {formik.touched.shortDescription && formik.errors.shortDescription && (
                  <p className="mt-1 text-xs text-red-600">{formik.errors.shortDescription}</p>
                )}
              </div>

              {storeId ? (
                <ProductCategoryField
                  storeId={storeId}
                  value={formik.values.category}
                  placeholder={isMenu ? 'Ej: Platos principales' : 'Ej: Ropa de hombre'}
                  onChange={(category) => void formik.setFieldValue('category', category)}
                />
              ) : null}
            </div>
          </CardBody>
        </Card>

        {/* Pricing & discount */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4">
              {isMenu ? 'Precio y descuento del plato' : 'Precio y descuento del producto'}
            </h3>
            <div className="space-y-4">
              {/* Regular price */}
              <Input
                id="regularPrice"
                label={isMenu ? 'Precio del plato *' : 'Precio normal *'}
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                hint={currency}
                {...formik.getFieldProps('regularPrice')}
                error={formik.touched.regularPrice ? formik.errors.regularPrice : undefined}
              />

              {/* Discount mode selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Descuento
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DISCOUNT_MODES.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleDiscountModeChange(value)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        formik.values.discountMode === value
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opción 1 — Precio promocional directo */}
              {formik.values.discountMode === 'direct_price' && (
                <Input
                  id="salePrice"
                  label="Precio promocional"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  hint={currency}
                  {...formik.getFieldProps('salePrice')}
                  error={formik.touched.salePrice ? formik.errors.salePrice : undefined}
                />
              )}

              {/* Opción 2 — Porcentaje de descuento */}
              {formik.values.discountMode === 'percentage' && (
                <Input
                  id="discountValue"
                  label="Porcentaje de descuento"
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  placeholder="Ej: 20"
                  hint="%"
                  {...formik.getFieldProps('discountValue')}
                  onChange={handleDiscountValueChange}
                  error={formik.touched.discountValue ? formik.errors.discountValue : undefined}
                />
              )}

              {/* Opción 3 — Valor fijo de descuento */}
              {formik.values.discountMode === 'fixed_amount' && (
                <Input
                  id="discountValue"
                  label="Descuento en valor"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Ej: 5000"
                  hint={currency}
                  {...formik.getFieldProps('discountValue')}
                  onChange={handleDiscountValueChange}
                  error={formik.touched.discountValue ? formik.errors.discountValue : undefined}
                />
              )}

              {/* Preview de descuento en vivo */}
              {discountPreview && (
                <div className="flex items-center gap-2 flex-wrap bg-green-50 border border-green-100 rounded-lg px-3 py-2.5 text-sm">
                  <span className="text-gray-400 line-through text-xs">
                    {formatCurrency(discountPreview.regular, 'es-CO', currency)}
                  </span>
                  <span className="font-bold text-green-700">
                    {formatCurrency(discountPreview.sale, 'es-CO', currency)}
                  </span>
                  <DiscountBadge percentage={discountPreview.pct} />
                  <span className="text-green-600 text-xs">
                    Ahorras {formatCurrency(discountPreview.savings, 'es-CO', currency)}
                  </span>
                </div>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Type-specific fields */}
        {isMenu ? (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-500" />
                Información del plato
              </h3>
              <Input
                id="preparationTimeMinutes"
                label="Tiempo de preparación (minutos)"
                type="number"
                min="1"
                placeholder="Ej: 20"
                {...formik.getFieldProps('preparationTimeMinutes')}
                error={
                  formik.touched.preparationTimeMinutes
                    ? formik.errors.preparationTimeMinutes
                    : undefined
                }
              />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-4">Inventario</h3>
              <div className="space-y-4">
                <Input
                  id="sku"
                  label="SKU (código interno)"
                  placeholder="Ej: CAM-001"
                  {...formik.getFieldProps('sku')}
                />
                <ToggleField
                  label="Rastrear inventario"
                  description="Descuenta stock con cada venta"
                  checked={formik.values.trackInventory}
                  onChange={(v) => void formik.setFieldValue('trackInventory', v)}
                />
                {formik.values.trackInventory && (
                  <Input
                    id="stockQuantity"
                    label="Cantidad en stock"
                    type="number"
                    min="0"
                    placeholder="0"
                    {...formik.getFieldProps('stockQuantity')}
                    error={
                      formik.touched.stockQuantity ? formik.errors.stockQuantity : undefined
                    }
                  />
                )}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardBody>
            <h3 className="mb-4 font-semibold text-gray-900">Indicaciones especiales</h3>
            <div className="space-y-4">
              <ToggleField
                label="Permitir indicaciones del cliente"
                description="Ejemplos: sin cebolla, salsa aparte, término 3/4, cortar en dos."
                checked={formik.values.allowsSpecialInstructions}
                onChange={(value) => void formik.setFieldValue('allowsSpecialInstructions', value)}
              />

              {formik.values.allowsSpecialInstructions ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    id="specialInstructionsLabel"
                    label="Título del campo"
                    placeholder="Indicaciones para tu pedido"
                    {...formik.getFieldProps('specialInstructionsLabel')}
                    error={formik.touched.specialInstructionsLabel ? formik.errors.specialInstructionsLabel : undefined}
                  />
                  <Input
                    id="specialInstructionsMaxLength"
                    label="Máximo de caracteres"
                    type="number"
                    min="40"
                    max="500"
                    {...formik.getFieldProps('specialInstructionsMaxLength')}
                    error={formik.touched.specialInstructionsMaxLength ? formik.errors.specialInstructionsMaxLength : undefined}
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      id="specialInstructionsPlaceholder"
                      label="Texto de ayuda"
                      rows={2}
                      placeholder="Ej: sin cebolla, salsa aparte, bien cocida"
                      {...formik.getFieldProps('specialInstructionsPlaceholder')}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </CardBody>
        </Card>

        <ProductOptionsEditor
          currency={currency}
          groups={optionGroups}
          onChange={setOptionGroups}
        />

        {/* Visibility */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-4">Visibilidad y estado</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label>
                <div className="flex gap-2">
                  {(['draft', 'active'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void formik.setFieldValue('status', s)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition-colors',
                        formik.values.status === s
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {s === 'draft' ? 'Borrador' : 'Publicado'}
                    </button>
                  ))}
                </div>
              </div>
              <ToggleField
                label="Disponible"
                description="Visible y disponible para pedir en el ecommerce"
                checked={formik.values.isAvailable}
                onChange={(v) => void formik.setFieldValue('isAvailable', v)}
              />
              <ToggleField
                label="Destacado"
                description="Aparece en la sección de destacados"
                checked={formik.values.isFeatured}
                onChange={(v) => void formik.setFieldValue('isFeatured', v)}
              />
            </div>
          </CardBody>
        </Card>

        {/* Images */}
        <Card>
          <CardBody>
            <h3 className="font-semibold text-gray-900 mb-1">Imágenes</h3>
            <p className="text-xs text-gray-400 mb-4">
              Máximo {MAX_IMAGES} imágenes. La primera será la principal. Todas se recortan en formato 1:1.
            </p>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
              {existingImages.map((img) => (
                <div
                  key={img.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                >
                  <img src={img.imageUrl} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteImage(img)}
                    disabled={deletingImageId === img.id}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deletingImageId === img.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <X className="w-3 h-3" />
                    )}
                  </button>
                  {img.isPrimary && (
                    <span className="absolute bottom-1 left-1 text-xs bg-black/60 text-white rounded px-1">
                      Principal
                    </span>
                  )}
                </div>
              ))}

              {pendingPreviews.map((url, i) => (
                <div
                  key={url}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePendingFile(i)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <span className="absolute bottom-1 left-1 text-xs bg-amber-500/80 text-white rounded px-1">
                    Por subir
                  </span>
                </div>
              ))}

              {totalImages < MAX_IMAGES && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                  <Upload className="w-5 h-5 text-gray-400 mb-1" />
                  <span className="text-xs text-gray-400">Subir</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </label>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Availability by location */}
        {activeLocations.length > 1 && (
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                Disponibilidad por sucursal
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Por defecto el {entitySingular} está disponible en todas las sucursales activas.
                Desactívalo en las sedes donde no deba aparecer.
              </p>
              <div className="space-y-3">
                {activeLocations.map(loc => (
                  <ToggleField
                    key={loc.id}
                    label={loc.name}
                    description={[loc.addressLine, loc.city].filter(Boolean).join(', ') || undefined}
                    checked={locationAvailability[loc.id] ?? true}
                    onChange={v => setLocationAvailability(prev => ({ ...prev, [loc.id]: v }))}
                  />
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {typeof formik.status === 'string' && (
          <FormErrorAlert message={formik.status} />
        )}

        <div className="flex items-center gap-3 pb-8">
          <Button type="submit" isLoading={formik.isSubmitting}>
            {isEditing ? 'Guardar cambios' : `Crear ${entitySingular}`}
          </Button>
          <Link to={`/admin/stores/${storeId}/products`}>
            <Button variant="outline" type="button">Cancelar</Button>
          </Link>
        </div>
      </form>

      <ConfirmDialog
        open={confirmDeleteImage !== null}
        title="Eliminar imagen"
        message="¿Estás seguro de que quieres eliminar esta imagen? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteImage) void handleDeleteExistingConfirmed(confirmDeleteImage);
        }}
        onCancel={() => setConfirmDeleteImage(null)}
      />

      <ImageCropDialog
        open={activeCrop !== null}
        file={activeCrop}
        preset={IMAGE_ASSET_PRESETS.product_image}
        onCancel={() => setActiveCrop(null)}
        onConfirm={appendPendingFile}
      />
    </div>
  );
}
