import { supabase } from '@/lib/supabase';
import type { StoreLimit } from '@/features/stores/stores.types';
import { mapStoreLimitRowToStoreLimit } from '@/features/stores/stores.mapper';
import { mapSubscriptionPlanRowToPlan, mapSubscriptionPlanUpdateToRow } from './plans.mapper';
import type { SubscriptionPlan, SubscriptionPlanUpdate } from './plans.types';

export const plansService = {
  async getPlans(includeInactive = true): Promise<SubscriptionPlan[]> {
    let query = supabase
      .from('subscription_plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapSubscriptionPlanRowToPlan);
  },

  async updatePlan(id: string, payload: SubscriptionPlanUpdate): Promise<SubscriptionPlan> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .update(mapSubscriptionPlanUpdateToRow(payload))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibió el plan actualizado.');
    return mapSubscriptionPlanRowToPlan(data);
  },

  async applyPlanToStore(storeId: string, plan: SubscriptionPlan): Promise<StoreLimit> {
    const { data, error } = await supabase
      .from('store_limits')
      .update({
        plan_key: plan.planKey,
        max_products: plan.maxProducts,
        max_staff: plan.maxStaff,
        max_active_offers: plan.maxActiveOffers,
        max_monthly_orders: plan.maxMonthlyOrders,
      })
      .eq('store_id', storeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No se recibieron los límites actualizados.');
    return mapStoreLimitRowToStoreLimit(data);
  },
};
