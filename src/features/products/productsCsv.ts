import type { Product } from './products.types';

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  draft: 'Borrador',
  inactive: 'Inactivo',
  archived: 'Archivado',
};

function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  // Quote everything that could break a column; neutralize spreadsheet
  // formulas (=, +, -, @) so a product name can't run code in Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** CSV (UTF-8 with BOM, opens correctly in Excel) of the given products,
 * one column per attribute (Marca, Género…) found among them. */
export function buildProductsCsv(
  products: Product[],
  options: { categoryLabelById: Map<string, string>; publicBaseUrl: string | null },
): string {
  const facetNames = Array.from(new Set(products.flatMap((product) => product.facetValues.map((value) => value.facetName))));
  const header = [
    'Nombre', 'SKU', 'Estado', 'Disponible', 'Destacado', 'Categoría', 'Colecciones',
    'Precio', 'Precio oferta', 'Costo', 'Stock', 'Controla inventario', 'Con variantes',
    ...facetNames, 'Imagen', 'URL pública', 'Creado', 'Última edición',
  ];
  const rows = products.map((product) => {
    const valuesByFacet = new Map<string, string[]>();
    for (const value of product.facetValues) {
      valuesByFacet.set(value.facetName, [...(valuesByFacet.get(value.facetName) ?? []), value.value]);
    }
    return [
      product.name,
      product.sku,
      STATUS_LABELS[product.status] ?? product.status,
      product.isAvailable ? 'Sí' : 'No',
      product.isFeatured ? 'Sí' : 'No',
      product.categoryId ? options.categoryLabelById.get(product.categoryId) ?? '' : '',
      product.collections.map((collection) => collection.name).join(' | '),
      product.regularPrice,
      product.salePrice,
      product.costPrice,
      product.trackInventory ? product.stock : '',
      product.trackInventory ? 'Sí' : 'No',
      product.hasVariants ? 'Sí' : 'No',
      ...facetNames.map((name) => (valuesByFacet.get(name) ?? []).join(' | ')),
      product.mainImageUrl,
      options.publicBaseUrl ? `${options.publicBaseUrl}/p/${product.slug}` : '',
      product.createdAt.slice(0, 10),
      product.updatedAt.slice(0, 10),
    ].map(cell).join(',');
  });
  const BOM = '\uFEFF';
  return BOM + [header.map(cell).join(','), ...rows].join('\r\n');
}
