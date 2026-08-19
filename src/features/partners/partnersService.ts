import { supabase } from '@/lib/supabase';
import type {
  PartnerCode,
  PartnerCodeQuote,
  PartnerCommission,
  PartnerCommissionStatus,
  CreatePartnerCodeInput,
  UpdatePartnerCodeInput,
  PartnerCodeStatus,
} from './partners.types';
import type {
  PartnerCommissionRow,
  PartnerCodeRedemptionRow,
  StorePartnerCodeRow,
  StorePartnerRow,
} from '@/types/database.types';

function normalizeCode(value: string) {
  return value.trim().toUpperCase();
}

function mapQuote(value: unknown): PartnerCodeQuote {
  const row = value as {
    valid?: boolean;
    code?: string;
    partner_name?: string;
    discount_type?: string;
    discount_value?: number;
    discount_amount?: number;
  };
  if (!row.valid || !row.code) throw new Error('El código no está disponible.');
  return {
    valid: true,
    code: row.code,
    partnerName: row.partner_name ?? 'Partner',
    discountType: row.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(row.discount_value ?? 0),
    discountAmount: Number(row.discount_amount ?? 0),
  };
}

function mapCode(
  row: StorePartnerCodeRow,
  partner: StorePartnerRow,
  redemptions: PartnerCodeRedemptionRow[],
  commissions: PartnerCommissionRow[],
): PartnerCode {
  const codeRedemptions = redemptions.filter((item) => item.partner_code_id === row.id);
  const codeCommissions = commissions.filter((item) => item.partner_code_id === row.id);
  return {
    id: row.id,
    storeId: row.store_id,
    partnerId: row.partner_id,
    partnerName: partner.name,
    partnerEmail: partner.email,
    partnerPhone: partner.phone,
    partnerNotes: partner.notes,
    code: row.code,
    discountType: row.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(row.discount_value),
    maxDiscountAmount: row.max_discount_amount == null ? null : Number(row.max_discount_amount),
    minSubtotal: Number(row.min_subtotal),
    commissionType: row.commission_type === 'fixed' ? 'fixed' : 'percentage',
    commissionValue: Number(row.commission_value),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    usageLimit: row.usage_limit,
    usageLimitPerCustomer: row.usage_limit_per_customer,
    status: row.status as PartnerCodeStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    redeemedCount: codeRedemptions.filter((item) => item.status === 'redeemed').length,
    revenueAmount: codeRedemptions
      .filter((item) => item.status === 'redeemed')
      .reduce((sum, item) => sum + Math.max(Number(item.subtotal_amount) - Number(item.discount_amount), 0), 0),
    commissionAmount: codeCommissions
      .filter((item) => item.status !== 'cancelled')
      .reduce((sum, item) => sum + Number(item.commission_amount), 0),
  };
}

function mapCommission(row: PartnerCommissionRow): PartnerCommission {
  return {
    id: row.id,
    storeId: row.store_id,
    partnerId: row.partner_id,
    partnerCodeId: row.partner_code_id,
    partnerCodeSnapshot: row.partner_code_snapshot,
    partnerNameSnapshot: row.partner_name_snapshot,
    orderId: row.order_id,
    redemptionId: row.redemption_id,
    commissionBaseAmount: Number(row.commission_base_amount),
    commissionAmount: Number(row.commission_amount),
    currency: row.currency,
    status: row.status as PartnerCommissionStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPartnerError(message: string): Error {
  const messages: Record<string, string> = {
    PARTNER_CODES_DISABLED: 'Este módulo todavía no está habilitado para la empresa.',
    PARTNER_CODE_INVALID: 'El código no existe o está inactivo.',
    PARTNER_CODE_NOT_STARTED: 'Este código todavía no está vigente.',
    PARTNER_CODE_EXPIRED: 'Este código ya venció.',
    PARTNER_CODE_MINIMUM_NOT_MET: 'El código requiere un subtotal mínimo.',
    PARTNER_CODE_USAGE_LIMIT_REACHED: 'Este código alcanzó su límite de usos.',
    PARTNER_CODE_CUSTOMER_LIMIT_REACHED: 'Ya alcanzaste el límite de uso de este código.',
    PARTNER_CODE_REQUIRED: 'Escribe un código válido.',
  };
  const key = Object.keys(messages).find((candidate) => message.includes(candidate));
  return new Error(key ? messages[key] : message);
}

export const partnersService = {
  async previewCode(storeSlug: string, code: string, subtotal: number): Promise<PartnerCodeQuote> {
    const { data, error } = await supabase.rpc('preview_partner_code', {
      p_store_slug: storeSlug,
      p_code: normalizeCode(code),
      p_subtotal: subtotal,
    });
    if (error) throw mapPartnerError(error.message);
    return mapQuote(data);
  },

  async getPartnerCodes(storeId: string): Promise<PartnerCode[]> {
    const [partnersResult, codesResult, redemptionsResult, commissionsResult] = await Promise.all([
      supabase.from('store_partners').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
      supabase.from('store_partner_codes').select('*').eq('store_id', storeId).order('created_at', { ascending: false }),
      supabase.from('partner_code_redemptions').select('*').eq('store_id', storeId),
      supabase.from('partner_commissions').select('*').eq('store_id', storeId),
    ]);
    if (partnersResult.error) throw new Error(partnersResult.error.message);
    if (codesResult.error) throw new Error(codesResult.error.message);
    if (redemptionsResult.error) throw new Error(redemptionsResult.error.message);
    if (commissionsResult.error) throw new Error(commissionsResult.error.message);

    const partners = (partnersResult.data ?? []) as StorePartnerRow[];
    const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
    return ((codesResult.data ?? []) as StorePartnerCodeRow[])
      .map((row) => {
        const partner = partnerById.get(row.partner_id);
        return partner
          ? mapCode(
              row,
              partner,
              (redemptionsResult.data ?? []) as PartnerCodeRedemptionRow[],
              (commissionsResult.data ?? []) as PartnerCommissionRow[],
            )
          : null;
      })
      .filter((item): item is PartnerCode => item !== null);
  },

  async getPartnerCommissions(storeId: string): Promise<PartnerCommission[]> {
    const { data, error } = await supabase
      .from('partner_commissions')
      .select('*')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as PartnerCommissionRow[]).map(mapCommission);
  },

  async createPartnerCode(input: CreatePartnerCodeInput): Promise<void> {
    const { error } = await supabase.rpc('create_store_partner_code', {
      p_store_id: input.storeId,
      p_partner_name: input.partnerName.trim(),
      p_partner_email: input.partnerEmail?.trim() || null,
      p_partner_phone: input.partnerPhone?.trim() || null,
      p_partner_notes: input.partnerNotes?.trim() || null,
      p_code: normalizeCode(input.code),
      p_discount_type: input.discountType,
      p_discount_value: input.discountValue,
      p_max_discount_amount: input.maxDiscountAmount,
      p_min_subtotal: input.minSubtotal,
      p_commission_type: input.commissionType,
      p_commission_value: input.commissionValue,
      p_starts_at: input.startsAt,
      p_ends_at: input.endsAt,
      p_usage_limit: input.usageLimit,
      p_usage_limit_per_customer: input.usageLimitPerCustomer,
    });
    if (error) throw mapPartnerError(error.message);
  },

  async updatePartnerCode(id: string, input: UpdatePartnerCodeInput): Promise<void> {
    const { data: codeRow, error: codeLookupError } = await supabase
      .from('store_partner_codes')
      .select('partner_id')
      .eq('id', id)
      .single();
    if (codeLookupError || !codeRow) throw new Error(codeLookupError?.message ?? 'No se encontró el código.');

    const { error: partnerUpdateError } = await supabase
      .from('store_partners')
      .update({
        name: input.partnerName.trim(),
        email: input.partnerEmail?.trim() || null,
        phone: input.partnerPhone?.trim() || null,
        notes: input.partnerNotes?.trim() || null,
      })
      .eq('id', codeRow.partner_id);
    if (partnerUpdateError) throw new Error(partnerUpdateError.message);

    const { error } = await supabase
      .from('store_partner_codes')
      .update({
        code: normalizeCode(input.code),
        discount_type: input.discountType,
        discount_value: input.discountValue,
        max_discount_amount: input.maxDiscountAmount,
        min_subtotal: input.minSubtotal,
        commission_type: input.commissionType,
        commission_value: input.commissionValue,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        usage_limit: input.usageLimit,
        usage_limit_per_customer: input.usageLimitPerCustomer,
      })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async setCodeStatus(id: string, status: PartnerCodeStatus): Promise<void> {
    const { error } = await supabase.from('store_partner_codes').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async setCommissionStatus(id: string, status: PartnerCommissionStatus): Promise<void> {
    const { error } = await supabase.from('partner_commissions').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
