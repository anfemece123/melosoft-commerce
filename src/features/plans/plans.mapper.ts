import type { SubscriptionPlanRow, SubscriptionPlanRowUpdate } from '@/types/database.types';
import type { SubscriptionPlan, SubscriptionPlanUpdate } from './plans.types';

export function mapSubscriptionPlanRowToPlan(row: SubscriptionPlanRow): SubscriptionPlan {
  return {
    id: row.id,
    planKey: row.plan_key as SubscriptionPlan['planKey'],
    name: row.name,
    description: row.description,
    maxProducts: row.max_products,
    maxStaff: row.max_staff,
    maxActiveOffers: row.max_active_offers,
    maxMonthlyOrders: row.max_monthly_orders,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSubscriptionPlanUpdateToRow(data: SubscriptionPlanUpdate): SubscriptionPlanRowUpdate {
  return {
    name: data.name,
    description: data.description,
    max_products: data.maxProducts,
    max_staff: data.maxStaff,
    max_active_offers: data.maxActiveOffers,
    max_monthly_orders: data.maxMonthlyOrders,
    is_active: data.isActive,
    sort_order: data.sortOrder,
  };
}
