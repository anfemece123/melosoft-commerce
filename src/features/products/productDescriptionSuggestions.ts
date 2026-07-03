import type { BusinessVertical } from '@/types/common.types';

export interface SuggestedSection {
  title: string;
  icon: string;
  placeholder: string;
}

const FOOD_SUGGESTIONS: SuggestedSection[] = [
  { title: 'Ingredientes', icon: 'leaf', placeholder: 'Lista los ingredientes principales...' },
  { title: 'Información nutricional', icon: 'info', placeholder: 'Calorías, proteínas, carbohidratos...' },
  { title: 'Alérgenos', icon: 'alertCircle', placeholder: 'Contiene: gluten, lácteos, maní...' },
  { title: 'Preparación', icon: 'chefHat', placeholder: 'Cómo se prepara o cocina...' },
  { title: 'Tiempo de preparación', icon: 'clock', placeholder: 'Tiempo estimado de preparación...' },
  { title: 'Incluye', icon: 'checkCircle', placeholder: 'Qué viene incluido en el pedido...' },
];

const RETAIL_SUGGESTIONS: SuggestedSection[] = [
  { title: 'Especificaciones técnicas', icon: 'wrench', placeholder: 'Dimensiones, peso, materiales...' },
  { title: 'Contenido del paquete', icon: 'package', placeholder: 'Qué incluye la caja...' },
  { title: 'Garantía', icon: 'shield', placeholder: 'Política de garantía del producto...' },
  { title: 'Instrucciones de uso', icon: 'fileText', placeholder: 'Cómo usar el producto paso a paso...' },
  { title: 'Cuidado y mantenimiento', icon: 'heart', placeholder: 'Instrucciones de limpieza y cuidado...' },
  { title: 'Beneficios', icon: 'award', placeholder: 'Ventajas y beneficios clave...' },
  { title: 'Envío', icon: 'truck', placeholder: 'Tiempos y condiciones de envío...' },
];

const CATALOG_SUGGESTIONS: SuggestedSection[] = [
  { title: 'Características', icon: 'star', placeholder: 'Características principales del servicio...' },
  { title: 'Qué incluye', icon: 'checkCircle', placeholder: 'Todo lo que está incluido en la propuesta...' },
  { title: 'Para quién es', icon: 'users', placeholder: 'Perfil del cliente ideal...' },
  { title: 'Especificaciones', icon: 'wrench', placeholder: 'Detalles técnicos o de dimensiones...' },
  { title: 'Beneficios', icon: 'award', placeholder: 'Ventajas de elegir este producto/servicio...' },
  { title: 'Proceso', icon: 'fileText', placeholder: 'Cómo funciona el proceso de compra o entrega...' },
];

const REAL_ESTATE_SUGGESTIONS: SuggestedSection[] = [
  { title: 'Descripción general', icon: 'info', placeholder: 'Describe el inmueble con detalle...' },
  { title: 'Características del inmueble', icon: 'star', placeholder: 'Habitaciones, baños, área...' },
  { title: 'Amenidades', icon: 'award', placeholder: 'Piscina, gimnasio, parqueadero...' },
  { title: 'Ubicación', icon: 'mapPin', placeholder: 'Zona, barrio, cercanía a puntos de referencia...' },
  { title: 'Especificaciones técnicas', icon: 'ruler', placeholder: 'Área total, área construida, estrato...' },
  { title: 'Información legal', icon: 'fileText', placeholder: 'Matrícula, escritura, estado legal...' },
];

const SUBCATEGORY_OVERRIDES: Record<string, SuggestedSection[]> = {
  barberia: [
    { title: 'Qué incluye el servicio', icon: 'checkCircle', placeholder: 'Describe los pasos del servicio...' },
    { title: 'Duración', icon: 'clock', placeholder: 'Tiempo aproximado del servicio...' },
    { title: 'Recomendaciones', icon: 'lightbulb', placeholder: 'Consejos antes y después del servicio...' },
  ],
  spa: [
    { title: 'Qué incluye', icon: 'checkCircle', placeholder: 'Detalla el servicio completo...' },
    { title: 'Beneficios', icon: 'heart', placeholder: 'Beneficios para la salud y bienestar...' },
    { title: 'Duración', icon: 'clock', placeholder: 'Duración del tratamiento...' },
  ],
};

export function getSuggestedSections(
  vertical: BusinessVertical,
  subcategory?: string | null
): SuggestedSection[] {
  if (subcategory && SUBCATEGORY_OVERRIDES[subcategory]) {
    return SUBCATEGORY_OVERRIDES[subcategory];
  }
  switch (vertical) {
    case 'food_restaurant': return FOOD_SUGGESTIONS;
    case 'retail_products': return RETAIL_SUGGESTIONS;
    case 'catalog_quote': return CATALOG_SUGGESTIONS;
    case 'real_estate': return REAL_ESTATE_SUGGESTIONS;
    default: return RETAIL_SUGGESTIONS;
  }
}
