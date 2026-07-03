import type { BusinessVertical } from '@/types/common.types';

export interface SpecialInstructionsLabels {
  sectionTitle: string;
  toggleLabel: string;
  toggleDescription: string;
  labelDefault: string;
  placeholderDefault: string;
}

export interface ProductFormLabels {
  entityName: string;
  entityNamePlural: string;
  namePlaceholder: string;
  pricingTitle: string;
  priceLabel: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  categoryHint: string;
  specialInstructions: SpecialInstructionsLabels;
}

function matchSub(sub: string | null, keywords: string[]): boolean {
  if (!sub) return false;
  const lower = sub.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

export function getProductFormLabels(params: {
  vertical: BusinessVertical | null;
  subcategory: string | null;
  isMenu: boolean;
}): ProductFormLabels {
  const { vertical, subcategory, isMenu } = params;

  // ── Restaurant / food ────────────────────────────────────────
  if (isMenu || vertical === 'food_restaurant') {
    return {
      entityName: 'plato',
      entityNamePlural: 'platos',
      namePlaceholder: 'Ej: Bandeja paisa, Hamburguesa clásica',
      pricingTitle: 'Precio y descuento del plato',
      priceLabel: 'Precio del plato',
      categoryLabel: 'Categoría del menú',
      categoryPlaceholder: 'Ej: Entradas, Platos principales, Bebidas, Postres',
      categoryHint: 'Agrupa los platos por sección del menú para que el cliente los encuentre fácil.',
      specialInstructions: {
        sectionTitle: 'Indicaciones del pedido',
        toggleLabel: 'Permitir indicaciones del cliente',
        toggleDescription: 'El cliente podrá agregar notas al hacer el pedido.',
        labelDefault: 'Indicaciones especiales del pedido',
        placeholderDefault:
          'Ej: sin cebolla, sin salsas, término de la carne, observaciones para cocina...',
      },
    };
  }

  // ── Retail — fashion / clothing ──────────────────────────────
  if (
    vertical === 'retail_products' &&
    matchSub(subcategory, ['ropa', 'moda', 'fashion', 'calzado', 'zapato', 'camisa', 'jean'])
  ) {
    return {
      entityName: 'producto',
      entityNamePlural: 'productos',
      namePlaceholder: 'Ej: Camisa de algodón slim fit, Jean clásico azul',
      pricingTitle: 'Precio del producto',
      priceLabel: 'Precio normal',
      categoryLabel: 'Categoría del producto',
      categoryPlaceholder: 'Ej: Ropa de hombre, Ropa de mujer, Accesorios, Calzado',
      categoryHint: 'Organiza tu catálogo por tipo de prenda o género.',
      specialInstructions: {
        sectionTitle: 'Notas del pedido',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá indicar talla alternativa, color preferido u otras notas.',
        labelDefault: 'Notas especiales del producto',
        placeholderDefault:
          'Ej: talla alternativa, color preferido, recomendación de ajuste o alguna aclaración...',
      },
    };
  }

  // ── Retail — fragrances / beauty ─────────────────────────────
  if (
    vertical === 'retail_products' &&
    matchSub(subcategory, ['locion', 'loción', 'perfume', 'fragancia', 'belleza', 'cosm', 'spa', 'skincare'])
  ) {
    return {
      entityName: 'producto',
      entityNamePlural: 'productos',
      namePlaceholder: 'Ej: Loción Blue Seduction 100ml, Perfume Dior Sauvage',
      pricingTitle: 'Precio del producto',
      priceLabel: 'Precio normal',
      categoryLabel: 'Categoría del producto',
      categoryPlaceholder: 'Ej: Lociones para hombre, Lociones para mujer, Kits y sets, Accesorios',
      categoryHint: 'Organiza tus productos por género, tipo de fragancia o presentación.',
      specialInstructions: {
        sectionTitle: 'Notas del pedido',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá indicar empaque, presentación u otras preferencias.',
        labelDefault: 'Notas especiales del producto',
        placeholderDefault:
          'Ej: empaque para regalo, aroma preferido si aplica, presentación deseada o alguna aclaración...',
      },
    };
  }

  // ── Retail — eyewear / accessories ──────────────────────────
  if (
    vertical === 'retail_products' &&
    matchSub(subcategory, ['gafa', 'lente', 'optic', 'accesorio', 'joya', 'bisuter'])
  ) {
    return {
      entityName: 'producto',
      entityNamePlural: 'productos',
      namePlaceholder: 'Ej: Gafas Ray-Ban Wayfarer, Aretes de plata 925',
      pricingTitle: 'Precio del producto',
      priceLabel: 'Precio normal',
      categoryLabel: 'Categoría del producto',
      categoryPlaceholder: 'Ej: Gafas de sol, Monturas, Lentes de contacto, Accesorios',
      categoryHint: 'Organiza tus productos por tipo de artículo o colección.',
      specialInstructions: {
        sectionTitle: 'Notas del pedido',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá indicar color del marco, tipo de estuche u otras preferencias.',
        labelDefault: 'Notas especiales del producto',
        placeholderDefault:
          'Ej: color del marco, tipo de estuche, referencia adicional o alguna aclaración...',
      },
    };
  }

  // ── Retail — technology / electronics ───────────────────────
  if (
    vertical === 'retail_products' &&
    matchSub(subcategory, ['tecnolog', 'electron', 'celular', 'computad', 'tablet', 'gadget', 'inform'])
  ) {
    return {
      entityName: 'producto',
      entityNamePlural: 'productos',
      namePlaceholder: 'Ej: iPhone 15 128GB, Laptop HP 15.6" Core i5',
      pricingTitle: 'Precio del producto',
      priceLabel: 'Precio normal',
      categoryLabel: 'Categoría del producto',
      categoryPlaceholder: 'Ej: Smartphones, Laptops, Accesorios, Periféricos',
      categoryHint: 'Organiza tus productos por tipo de dispositivo o categoría tecnológica.',
      specialInstructions: {
        sectionTitle: 'Notas del pedido',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá indicar color, capacidad u otras especificaciones.',
        labelDefault: 'Notas especiales del producto',
        placeholderDefault:
          'Ej: color preferido, capacidad deseada, referencia exacta o alguna aclaración...',
      },
    };
  }

  // ── Retail — generic fallback ────────────────────────────────
  if (vertical === 'retail_products') {
    return {
      entityName: 'producto',
      entityNamePlural: 'productos',
      namePlaceholder: 'Ej: Nombre del producto',
      pricingTitle: 'Precio del producto',
      priceLabel: 'Precio normal',
      categoryLabel: 'Categoría del producto',
      categoryPlaceholder: 'Ej: Categoría principal, Subcategoría, Tipo',
      categoryHint: 'Organiza tus productos para que el cliente los encuentre más fácil.',
      specialInstructions: {
        sectionTitle: 'Notas del pedido',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá agregar notas o aclaraciones al realizar el pedido.',
        labelDefault: 'Notas especiales del producto',
        placeholderDefault:
          'Ej: color preferido, empaque para regalo, referencia adicional o alguna aclaración...',
      },
    };
  }

  // ── Catalog / quote ──────────────────────────────────────────
  if (vertical === 'catalog_quote') {
    return {
      entityName: 'ítem',
      entityNamePlural: 'ítems',
      namePlaceholder: 'Ej: Impresión personalizada, Servicio de diseño gráfico',
      pricingTitle: 'Precio base',
      priceLabel: 'Precio base',
      categoryLabel: 'Categoría del catálogo',
      categoryPlaceholder: 'Ej: Productos personalizados, Materiales, Paquetes, Servicios',
      categoryHint: 'Agrupa los ítems del catálogo para facilitar la navegación.',
      specialInstructions: {
        sectionTitle: 'Notas para la cotización',
        toggleLabel: 'Permitir notas del cliente',
        toggleDescription: 'El cliente podrá agregar detalles para que puedas cotizar con precisión.',
        labelDefault: 'Notas para la cotización',
        placeholderDefault:
          'Ej: cantidad requerida, medidas, material, referencia o detalles para cotizar...',
      },
    };
  }

  // ── Real estate ──────────────────────────────────────────────
  if (vertical === 'real_estate') {
    return {
      entityName: 'inmueble',
      entityNamePlural: 'inmuebles',
      namePlaceholder: 'Ej: Apartamento 2 hab. Laureles, Casa 3 pisos El Poblado',
      pricingTitle: 'Precio del inmueble',
      priceLabel: 'Precio de venta',
      categoryLabel: 'Tipo de inmueble',
      categoryPlaceholder: 'Ej: Apartamento, Casa, Local, Bodega, Lote',
      categoryHint: 'Clasifica el tipo de inmueble para facilitar la búsqueda.',
      specialInstructions: {
        sectionTitle: 'Notas de contacto',
        toggleLabel: 'Permitir mensaje del interesado',
        toggleDescription: 'El interesado podrá escribir un mensaje al solicitar información.',
        labelDefault: 'Mensaje para el asesor',
        placeholderDefault:
          'Ej: número de personas, presupuesto mensual, disponibilidad para visita o preguntas...',
      },
    };
  }

  // ── Default fallback ─────────────────────────────────────────
  return {
    entityName: 'producto',
    entityNamePlural: 'productos',
    namePlaceholder: 'Ej: Nombre del producto o servicio',
    pricingTitle: 'Precio',
    priceLabel: 'Precio',
    categoryLabel: 'Categoría',
    categoryPlaceholder: 'Ej: Categoría principal',
    categoryHint: 'Organiza tus productos o servicios por categoría.',
    specialInstructions: {
      sectionTitle: 'Notas del pedido',
      toggleLabel: 'Permitir notas del cliente',
      toggleDescription: 'El cliente podrá agregar notas o aclaraciones al realizar el pedido.',
      labelDefault: 'Notas especiales',
      placeholderDefault: 'Ej: color preferido, referencia adicional o alguna aclaración...',
    },
  };
}
