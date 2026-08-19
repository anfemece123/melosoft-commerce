import type { AsyncStatus } from '@/types/common.types';

export type PartnerStatus = 'active' | 'inactive' | 'archived';
export type PartnerCodeStatus = PartnerStatus;
export type PartnerRuleType = 'percentage' | 'fixed';
export type PartnerCommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface PartnerCommission {
  id: string;
  storeId: string;
  partnerId: string;
  partnerCodeId: string;
  partnerCodeSnapshot: string;
  partnerNameSnapshot: string;
  orderId: string;
  redemptionId: string | null;
  commissionBaseAmount: number;
  commissionAmount: number;
  currency: string;
  status: PartnerCommissionStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  storeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerCode {
  id: string;
  storeId: string;
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
  partnerPhone: string | null;
  partnerNotes: string | null;
  code: string;
  discountType: PartnerRuleType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minSubtotal: number;
  commissionType: PartnerRuleType;
  commissionValue: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  status: PartnerCodeStatus;
  createdAt: string;
  updatedAt: string;
  redeemedCount: number;
  revenueAmount: number;
  commissionAmount: number;
}

export interface CreatePartnerCodeInput {
  storeId: string;
  partnerName: string;
  partnerEmail: string | null;
  partnerPhone: string | null;
  partnerNotes: string | null;
  code: string;
  discountType: PartnerRuleType;
  discountValue: number;
  maxDiscountAmount: number | null;
  minSubtotal: number;
  commissionType: PartnerRuleType;
  commissionValue: number;
  startsAt: string | null;
  endsAt: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
}

export type UpdatePartnerCodeInput = Omit<CreatePartnerCodeInput, 'storeId'>;

export interface PartnerCodeQuote {
  valid: true;
  code: string;
  partnerName: string;
  discountType: PartnerRuleType;
  discountValue: number;
  discountAmount: number;
}

export interface PartnersState {
  items: PartnerCode[];
  status: AsyncStatus;
  error: string | null;
}
