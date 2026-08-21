import type { PlanKey } from '@/types/common.types';

export interface SubscriptionPlan {
  id: string;
  planKey: PlanKey;
  name: string;
  description: string;
  maxProducts: number;
  maxStaff: number;
  maxActiveOffers: number;
  maxMonthlyOrders: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionPlanUpdate = Pick<
  SubscriptionPlan,
  'name' | 'description' | 'maxProducts' | 'maxStaff' | 'maxActiveOffers' | 'maxMonthlyOrders' | 'isActive' | 'sortOrder'
>;
