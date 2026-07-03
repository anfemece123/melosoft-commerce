import { Home, StoreIcon } from 'lucide-react';
import type { FormikProps } from 'formik';
import type { CheckoutFormValues } from '@/schemas/order.schema';
import type { StorefrontTheme } from '../storefront/storefrontTheme';

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
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
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
          borderColor: touched && error ? '#ef4444' : theme.border,
        }}
      />
      {touched && error && (
        <p className="text-xs text-red-500">{error as string}</p>
      )}
    </div>
  );
}

interface CheckoutCustomerFormProps {
  theme: StorefrontTheme;
  formik: FormikProps<CheckoutFormValues>;
  hasFulfillmentChoice: boolean;
}

export function CheckoutCustomerForm({ theme, formik, hasFulfillmentChoice }: CheckoutCustomerFormProps) {
  return (
    <>
      {/* Fulfillment method */}
      {hasFulfillmentChoice ? (
        <div className="space-y-2">
          <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
            ¿Cómo deseas recibir tu pedido?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'delivery', label: 'A domicilio', icon: Home },
                { value: 'pickup', label: 'Retiro en tienda', icon: StoreIcon },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => formik.setFieldValue('fulfillmentMethod', value)}
                className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-medium transition-colors"
                style={{
                  borderColor: formik.values.fulfillmentMethod === value ? theme.primary : theme.border,
                  backgroundColor: formik.values.fulfillmentMethod === value ? `${theme.primary}12` : theme.surface,
                  color: formik.values.fulfillmentMethod === value ? theme.primary : theme.mutedText,
                }}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
          style={{ backgroundColor: `${theme.primary}10`, color: theme.primary }}
        >
          {formik.values.fulfillmentMethod === 'pickup'
            ? <><StoreIcon className="h-4 w-4 shrink-0" /> Retiro en tienda</>
            : <><Home className="h-4 w-4 shrink-0" /> Entrega a domicilio</>}
        </div>
      )}

      {/* Delivery address — city/department come from selectedLocation, not editable */}
      {formik.values.fulfillmentMethod === 'delivery' && (
        <div className="space-y-3">
          <p className="text-xs font-medium" style={{ color: theme.mutedText }}>
            Dirección de entrega
          </p>
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

      {/* Contact info */}
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

      {/* Notes */}
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
          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
          style={{ backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }}
        />
      </div>
    </>
  );
}
