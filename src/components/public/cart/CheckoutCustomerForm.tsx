import { useEffect, useState } from 'react';
import { Home, MapPinned, StoreIcon, Truck } from 'lucide-react';
import type { FormikProps } from 'formik';
import { geoService } from '@/features/geo/geoService';
import type { GeoCity, GeoDepartment } from '@/features/geo/geo.types';
import type { PublicStoreLocation } from '@/features/locations/locations.types';
import type { CheckoutFormValues } from '@/schemas/order.schema';
import type { StorefrontTheme } from '../storefront/storefrontTheme';
import type { CheckoutFulfillmentMethod, LocationCityOption } from '@/lib/orders/fulfillment';
import { getPickupLocations } from '@/lib/orders/fulfillment';
import { getFulfillmentMethodLabel, getFulfillmentMethodDescription } from '@/lib/orders/fulfillmentLabels';
import { formatCurrency } from '@/utils/formatCurrency';

interface CheckoutFieldProps {
  formik: FormikProps<CheckoutFormValues>;
  theme: StorefrontTheme;
  name: keyof CheckoutFormValues;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
}

function CheckoutField({ formik, theme, name, label, required, placeholder, type = 'text' }: CheckoutFieldProps) {
  const touched = formik.touched[name];
  const error = formik.errors[name];
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: theme.mutedText }}>
        {label}{required && <span className="ml-0.5" style={{ color: theme.primary }}>*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={formik.values[name] as string}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        placeholder={placeholder}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2"
        style={{
          backgroundColor: theme.surface,
          color: theme.text,
          borderColor: touched && error ? theme.primary : theme.border,
        }}
      />
      {touched && error && (
        <p className="text-xs" style={{ color: theme.primary }}>{error as string}</p>
      )}
    </div>
  );
}

interface CheckoutSelectProps {
  label: string;
  required?: boolean;
  value: string;
  disabled?: boolean;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  theme: StorefrontTheme;
  error?: string;
}

function CheckoutSelect({
  label,
  required,
  value,
  disabled,
  options,
  onChange,
  theme,
  error,
}: CheckoutSelectProps) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium" style={{ color: theme.mutedText }}>
        {label}{required && <span className="ml-0.5" style={{ color: theme.primary }}>*</span>}
      </label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none appearance-none disabled:opacity-60"
        style={{
          backgroundColor: theme.surface,
          color: theme.text,
          borderColor: error ? theme.primary : theme.border,
        }}
      >
        <option value="">Selecciona una opción</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs" style={{ color: theme.primary }}>{error}</p> : null}
    </div>
  );
}

interface CheckoutCustomerFormProps {
  theme: StorefrontTheme;
  formik: FormikProps<CheckoutFormValues>;
  hasFulfillmentChoice: boolean;
  availableFulfillmentMethods: CheckoutFulfillmentMethod[];
  locations: PublicStoreLocation[];
  selectedLocation: PublicStoreLocation | null;
  localDeliveryCities: LocationCityOption[];
  operationalLocation: PublicStoreLocation | null;
  currency: string;
  localDeliveryBaseFee?: number | null;
  localDeliveryFreeFrom?: number | null;
  nationalShippingBaseFee?: number | null;
  nationalShippingFreeFrom?: number | null;
  localDeliveryNotes?: string | null;
  nationalShippingNotes?: string | null;
  onSelectSuggestedLocation?: (location: PublicStoreLocation) => void;
}

const FULFILLMENT_ICONS: Record<CheckoutFulfillmentMethod, typeof Home> = {
  local_delivery: Home,
  national_shipping: Truck,
  pickup: StoreIcon,
};

export function CheckoutCustomerForm({
  theme,
  formik,
  hasFulfillmentChoice,
  availableFulfillmentMethods,
  locations,
  selectedLocation,
  localDeliveryCities,
  operationalLocation,
  currency,
  localDeliveryBaseFee,
  localDeliveryFreeFrom,
  nationalShippingBaseFee,
  nationalShippingFreeFrom,
  localDeliveryNotes,
  nationalShippingNotes,
  onSelectSuggestedLocation,
}: CheckoutCustomerFormProps) {
  const [departments, setDepartments] = useState<GeoDepartment[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  const selectedMethod = formik.values.fulfillmentMethod;
  // Context for the central label/description helper — only passed when
  // unambiguous (a single local-delivery city, more than one pickup-
  // enabled sede), so it never invents a city/sede that isn't really there.
  const pickupLocationCount = getPickupLocations(locations).length;
  const singleLocalDeliveryCity = localDeliveryCities.length === 1 ? localDeliveryCities[0].city : null;
  function describeFulfillmentMethod(method: CheckoutFulfillmentMethod) {
    const context = method === 'pickup'
      ? { hasMultipleLocations: pickupLocationCount > 1 }
      : method === 'local_delivery'
      ? { city: singleLocalDeliveryCity }
      : {};
    return {
      label: getFulfillmentMethodLabel(method, context),
      description: getFulfillmentMethodDescription(method, context),
      icon: FULFILLMENT_ICONS[method],
    };
  }
  const departmentError = formik.touched.shippingDepartmentId ? formik.errors.shippingDepartmentId : undefined;
  const cityError = formik.touched.shippingCityId ? formik.errors.shippingCityId : undefined;
  const shippingCityName = formik.values.shippingCityName.trim().toLowerCase();
  const shippingDepartmentName = formik.values.shippingDepartmentName.trim().toLowerCase();
  const suggestedLocalLocation = selectedMethod === 'national_shipping' && shippingCityName
    ? locations.find((location) =>
      location.city?.trim().toLowerCase() === shippingCityName &&
      (shippingDepartmentName
        ? location.department?.trim().toLowerCase() === shippingDepartmentName
        : true))
    : null;
  const hasLocalDelivery = availableFulfillmentMethods.includes('local_delivery');
  const localDeliveryRuleSummary = [
    localDeliveryBaseFee && localDeliveryBaseFee > 0
      ? `Costo base ${formatCurrency(localDeliveryBaseFee, 'es-CO', currency)}`
      : 'Costo sujeto a validación',
    localDeliveryFreeFrom && localDeliveryFreeFrom > 0
      ? `gratis desde ${formatCurrency(localDeliveryFreeFrom, 'es-CO', currency)}`
      : null,
  ].filter(Boolean).join(' · ');
  const nationalShippingRuleSummary = [
    nationalShippingBaseFee && nationalShippingBaseFee > 0
      ? `Costo base ${formatCurrency(nationalShippingBaseFee, 'es-CO', currency)}`
      : 'Costo sujeto a validación',
    nationalShippingFreeFrom && nationalShippingFreeFrom > 0
      ? `gratis desde ${formatCurrency(nationalShippingFreeFrom, 'es-CO', currency)}`
      : null,
  ].filter(Boolean).join(' · ');

  useEffect(() => {
    if (!availableFulfillmentMethods.includes('national_shipping')) return;
    let cancelled = false;

    geoService.getDepartments('CO')
      .then((items) => {
        if (!cancelled) setDepartments(items);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });

    return () => { cancelled = true; };
  }, [availableFulfillmentMethods]);

  useEffect(() => {
    if (selectedMethod !== 'national_shipping' || !formik.values.shippingDepartmentId) {
      setCities([]);
      return;
    }

    let cancelled = false;
    setLoadingCities(true);

    geoService.getCities(formik.values.shippingDepartmentId)
      .then((items) => {
        if (!cancelled) setCities(items);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });

    return () => { cancelled = true; };
  }, [selectedMethod, formik.values.shippingDepartmentId]);

  function handleFulfillmentChange(method: CheckoutFulfillmentMethod) {
    void formik.setFieldValue('fulfillmentMethod', method);
    if (method !== 'national_shipping') {
      void formik.setFieldValue('shippingDepartmentId', '');
      void formik.setFieldValue('shippingDepartmentName', '');
      void formik.setFieldValue('shippingCityId', '');
      void formik.setFieldValue('shippingCityName', '');
    }
  }

  function handleDepartmentChange(departmentId: string) {
    const department = departments.find((item) => item.id === departmentId);
    void formik.setFieldValue('shippingDepartmentId', departmentId);
    void formik.setFieldValue('shippingDepartmentName', department?.name ?? '');
    void formik.setFieldValue('shippingCityId', '');
    void formik.setFieldValue('shippingCityName', '');
  }

  function handleCityChange(cityId: string) {
    const city = cities.find((item) => item.id === cityId);
    void formik.setFieldValue('shippingCityId', cityId);
    void formik.setFieldValue('shippingCityName', city?.name ?? '');
  }

  return (
    <>
      {hasFulfillmentChoice ? (
        <div className="space-y-3">
          <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
            ¿Cómo deseas recibir tu pedido?
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            {availableFulfillmentMethods.map((method) => {
              const option = describeFulfillmentMethod(method);
              const Icon = option.icon;
              const selected = selectedMethod === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => handleFulfillmentChange(method)}
                  className="flex flex-col items-start gap-2 rounded-xl border px-4 py-4 text-left transition-colors"
                  style={{
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.softPrimary : theme.surface,
                    color: selected ? theme.primary : theme.text,
                  }}
                >
                  <Icon className="h-5 w-5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="text-xs leading-5" style={{ color: selected ? theme.primary : theme.mutedText }}>
                      {option.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ backgroundColor: theme.softPrimary, color: theme.primary }}
        >
          {(selectedMethod === 'pickup' || selectedMethod === 'local_delivery' || selectedMethod === 'national_shipping') && (() => {
            const option = describeFulfillmentMethod(selectedMethod);
            const Icon = option.icon;
            return <><Icon className="h-4 w-4 shrink-0" /> {option.label}</>;
          })()}
        </div>
      )}

      {selectedMethod === 'pickup' && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: theme.surfaceAlt, color: theme.text }}
        >
          <p className="font-medium">Retiras tu pedido en la sede seleccionada.</p>
          {selectedLocation && (
            <p className="mt-1 text-xs" style={{ color: theme.mutedText }}>
              {selectedLocation.name}
              {selectedLocation.city ? ` · ${selectedLocation.city}` : ''}
              {selectedLocation.department ? `, ${selectedLocation.department}` : ''}
            </p>
          )}
        </div>
      )}

      {selectedMethod === 'local_delivery' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
              Dirección de entrega
            </p>
            {localDeliveryCities.length > 1 ? (
              <CheckoutSelect
                label="Ciudad de entrega"
                required
                value={formik.values.localDeliveryCity}
                options={localDeliveryCities.map((item) => ({
                  value: item.city,
                  label: item.department ? `${item.city}, ${item.department}` : item.city,
                }))}
                onChange={(value) => void formik.setFieldValue('localDeliveryCity', value)}
                theme={theme}
                error={selectedMethod === 'local_delivery' && !formik.values.localDeliveryCity
                  ? 'Selecciona la ciudad donde se entregará el pedido'
                  : undefined}
              />
            ) : null}
            {operationalLocation && (
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-3 text-sm"
                style={{ backgroundColor: theme.surfaceAlt, color: theme.text }}
              >
                <MapPinned className="mt-0.5 h-4 w-4 shrink-0" style={{ color: theme.primary }} />
                <div>
                  <p className="font-medium">Cobertura local disponible</p>
                  <p className="mt-0.5 text-xs" style={{ color: theme.mutedText }}>
                    {operationalLocation.city ?? 'Ciudad no definida'}
                    {operationalLocation.department ? `, ${operationalLocation.department}` : ''}
                  </p>
                </div>
              </div>
            )}
            {localDeliveryNotes ? (
              <p className="text-xs leading-5" style={{ color: theme.mutedText }}>
                {localDeliveryNotes}
              </p>
            ) : null}
            {localDeliveryRuleSummary ? (
              <p className="text-xs leading-5 font-medium" style={{ color: theme.text }}>
                {localDeliveryRuleSummary}
              </p>
            ) : null}
          </div>

          <CheckoutField
            formik={formik}
            theme={theme}
            name="shippingAddress"
            label="Dirección"
            required
            placeholder="Calle 45 # 23-10, Apto 301"
          />
          <CheckoutField
            formik={formik}
            theme={theme}
            name="deliveryNeighborhood"
            label="Barrio"
            placeholder="El Poblado"
          />
          <CheckoutField
            formik={formik}
            theme={theme}
            name="deliveryReference"
            label="Referencia"
            placeholder="Portería principal, timbre 3"
          />
        </div>
      )}

      {selectedMethod === 'national_shipping' && (
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
              Destino del envío
            </p>
            {nationalShippingNotes ? (
              <p className="text-xs leading-5" style={{ color: theme.mutedText }}>
                {nationalShippingNotes}
              </p>
            ) : null}
            {nationalShippingRuleSummary ? (
              <p className="text-xs leading-5 font-medium" style={{ color: theme.text }}>
                {nationalShippingRuleSummary}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <CheckoutSelect
              label="Departamento"
              required
              value={formik.values.shippingDepartmentId}
              options={departments.map((department) => ({ value: department.id, label: department.name }))}
              onChange={handleDepartmentChange}
              theme={theme}
              error={typeof departmentError === 'string' ? departmentError : undefined}
            />
            <CheckoutSelect
              label="Ciudad"
              required
              value={formik.values.shippingCityId}
              disabled={!formik.values.shippingDepartmentId || loadingCities}
              options={cities.map((city) => ({ value: city.id, label: city.name }))}
              onChange={handleCityChange}
              theme={theme}
              error={typeof cityError === 'string' ? cityError : undefined}
            />
          </div>

          {hasLocalDelivery && suggestedLocalLocation ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={{ borderColor: theme.border, backgroundColor: theme.surfaceAlt, color: theme.text }}
            >
              <p className="font-medium">Esta ciudad coincide con una sede activa.</p>
              <p className="mt-1 text-xs leading-5" style={{ color: theme.mutedText }}>
                Si prefieres gestionar el pedido como domicilio local, puedes cambiar automáticamente a la sede
                {` ${suggestedLocalLocation.name}`}
                {suggestedLocalLocation.city ? ` · ${suggestedLocalLocation.city}` : ''}.
              </p>
              <button
                type="button"
                onClick={() => {
                  onSelectSuggestedLocation?.(suggestedLocalLocation);
                  handleFulfillmentChange('local_delivery');
                }}
                className="mt-3 text-xs font-semibold transition-opacity hover:opacity-80"
                style={{ color: theme.primary }}
              >
                Usar domicilio local
              </button>
            </div>
          ) : null}

          <CheckoutField
            formik={formik}
            theme={theme}
            name="shippingAddress"
            label="Dirección de envío"
            required
            placeholder="Calle 45 # 23-10, Apto 301"
          />
          <CheckoutField
            formik={formik}
            theme={theme}
            name="deliveryNeighborhood"
            label="Barrio o sector"
            placeholder="Zona o barrio"
          />
          <CheckoutField
            formik={formik}
            theme={theme}
            name="deliveryReference"
            label="Referencia"
            placeholder="Conjunto, torre, portería o indicación útil"
          />
        </div>
      )}

      <div className="space-y-3">
        <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
          Datos de contacto
        </p>
        <CheckoutField
          formik={formik}
          theme={theme}
          name="customerName"
          label="Nombre completo"
          required
          placeholder="María García"
        />
        <CheckoutField
          formik={formik}
          theme={theme}
          name="customerPhone"
          label="Teléfono"
          required
          placeholder="3001234567"
          type="tel"
        />
        <CheckoutField
          formik={formik}
          theme={theme}
          name="customerEmail"
          label="Email (opcional)"
          placeholder="correo@ejemplo.com"
          type="email"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: theme.mutedText }}>
          Notas adicionales (opcional)
        </label>
        <textarea
          name="notes"
          rows={2}
          value={formik.values.notes}
          onChange={formik.handleChange}
          placeholder="Indicaciones especiales para tu pedido..."
          className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none"
          style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
        />
      </div>
    </>
  );
}
