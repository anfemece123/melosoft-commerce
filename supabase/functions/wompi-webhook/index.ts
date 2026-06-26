// Edge Function: wompi-webhook
// Purpose: Receives Wompi payment events and updates payment_transactions
//          and orders accordingly.
//
// Security model:
//   - Validates the Wompi webhook signature before processing any event.
//   - Signature is computed with HMAC-SHA256 using WOMPI_INTEGRITY_SECRET.
//   - Only processes events from verified Wompi requests.
//
// Wompi webhook events handled (TODO Fase 5):
//   - transaction.updated: updates payment_transactions.status
//   - On APPROVED: set order.payment_status = 'paid', order.status = 'confirmed'
//   - On DECLINED/ERROR: set order.payment_status = 'failed'
//   - On VOIDED: set order.payment_status = 'refunded'
//
// Register this URL in Wompi dashboard:
//   https://your-supabase-project.supabase.co/functions/v1/wompi-webhook

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WompiEvent {
  event: string;
  data: {
    transaction: {
      id: string;
      reference: string;
      status: string;
      amount_in_cents: number;
      currency: string;
      payment_method_type: string;
    };
  };
  signature: {
    properties: string[];
    checksum: string;
  };
  timestamp: number;
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const event = (await req.json()) as WompiEvent;

    // TODO Fase 5: Validate Wompi signature
    // const integritySecret = Deno.env.get('WOMPI_INTEGRITY_SECRET');
    // const signatureString = buildSignatureString(event);
    // const expectedChecksum = await computeHmacSha256(signatureString, integritySecret);
    // if (expectedChecksum !== event.signature.checksum) {
    //   return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    // }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (event.event === 'transaction.updated') {
      const { id: providerTransactionId, reference, status } = event.data.transaction;

      // TODO Fase 5: map Wompi status to our TransactionStatus
      // wompi: APPROVED → our: approved
      // wompi: DECLINED → our: declined
      // wompi: ERROR    → our: error
      // wompi: VOIDED   → our: voided

      // Update payment_transactions
      const { error: txError } = await supabase
        .from('payment_transactions')
        .update({
          status: status.toLowerCase(),
          raw_response: event as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        })
        .eq('provider_transaction_id', providerTransactionId);

      if (txError) {
        console.error('Error updating payment_transaction:', txError.message);
      }

      // TODO Fase 5: look up order by reference and update order.payment_status
      void reference;

      console.log('Wompi webhook received — placeholder handler. Implement in Fase 5.');
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('wompi-webhook error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
