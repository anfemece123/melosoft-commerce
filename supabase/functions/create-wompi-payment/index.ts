// Edge Function: create-wompi-payment
// Purpose: Receives an order_id, validates the order, and prepares
//          a Wompi payment transaction.
//
// Security model:
//   - Private keys are NEVER sent from the frontend.
//   - This Edge Function reads secrets from Supabase Edge Function environment:
//       WOMPI_PRIVATE_KEY  (set via: supabase secrets set WOMPI_PRIVATE_KEY=...)
//       WOMPI_INTEGRITY_SECRET
//   - The frontend only sends the order_id (public identifier).
//
// Usage (frontend via paymentsService.createWompiPayment):
//   supabase.functions.invoke('create-wompi-payment', { body: { order_id } })
//
// TODO (Fase 5 — pagos reales):
//   1. Read WOMPI_PRIVATE_KEY from Deno.env.get('WOMPI_PRIVATE_KEY')
//   2. Build the Wompi transaction payload with amount, currency, redirect_url
//   3. Generate the integrity signature using WOMPI_INTEGRITY_SECRET
//   4. POST to Wompi API: https://api.wompi.co/v1/transactions
//   5. Store the transaction in payment_transactions table
//   6. Return the redirectUrl to the frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  order_id: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const { order_id } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Validate order exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, store_id, total_amount, currency, payment_status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (order.payment_status === 'paid') {
      return new Response(JSON.stringify({ error: 'Order already paid' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // TODO: Read Wompi credentials from store_payment_settings + Edge Function secrets
    // const wompiPrivateKey = Deno.env.get('WOMPI_PRIVATE_KEY');
    // const wompiIntegritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET');

    // Placeholder response — replace with real Wompi API call in Fase 5
    return new Response(
      JSON.stringify({
        message: 'Wompi payment placeholder — implement in Fase 5',
        order_id: order.id,
        amount: order.total_amount,
        currency: order.currency,
        redirectUrl: `/s/placeholder/o/placeholder`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
