// Public, token-authorized upload for verified-review photos. The browser
// never receives service credentials and cannot choose an arbitrary path.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
const MAX_BYTES = 950 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function detectImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return { mime: 'image/webp', extension: 'webp' };
  }
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') {
    const brand = String.fromCharCode(...bytes.slice(8, 16));
    if (brand.includes('avif') || brand.includes('avis')) return { mime: 'image/avif', extension: 'avif' };
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Invalid multipart body' }, 400);
  }

  const token = String(form.get('token') ?? '');
  const reviewId = String(form.get('reviewId') ?? '');
  const sortOrder = Number(form.get('sortOrder'));
  const file = form.get('file');
  if (!UUID_PATTERN.test(token) || !UUID_PATTERN.test(reviewId) || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 2) {
    return json({ error: 'Invalid review upload request' }, 400);
  }
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES) {
    return json({ error: 'La foto debe pesar menos de 950 KB.' }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(bytes);
  if (!detected) return json({ error: 'La foto no tiene un formato de imagen válido.' }, 400);

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (!serviceRoleKey || !supabaseUrl) return json({ error: 'Storage is not configured' }, 503);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const { data: review, error: reviewError } = await admin.from('product_reviews')
    .select('id, store_id, invitation_id')
    .eq('id', reviewId)
    .maybeSingle();
  if (reviewError || !review) return json({ error: 'Review not found' }, 404);

  const { data: invitation, error: invitationError } = await admin.from('review_invitations')
    .select('id, token, submitted_at')
    .eq('id', review.invitation_id)
    .eq('token', token)
    .maybeSingle();
  if (invitationError || !invitation?.submitted_at) return json({ error: 'Invalid review invitation' }, 403);

  const { data: settings } = await admin.from('store_review_settings')
    .select('mode, show_review_photos')
    .eq('store_id', review.store_id)
    .maybeSingle();
  if (!settings || settings.mode === 'disabled' || !settings.show_review_photos) {
    return json({ error: 'Review photos are disabled' }, 403);
  }

  const storagePath = `reviews/${review.store_id}/${review.id}/${crypto.randomUUID()}.${detected.extension}`;
  const { error: uploadError } = await admin.storage.from('store-assets').upload(storagePath, bytes, {
    contentType: detected.mime,
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploadError) return json({ error: 'No se pudo guardar la foto.' }, 500);

  const { data: publicUrlData } = admin.storage.from('store-assets').getPublicUrl(storagePath);
  const { data: image, error: insertError } = await admin.from('product_review_images').insert({
    review_id: review.id,
    store_id: review.store_id,
    image_url: publicUrlData.publicUrl,
    storage_path: storagePath,
    sort_order: sortOrder,
  }).select('id, image_url, sort_order').single();

  if (insertError || !image) {
    await admin.storage.from('store-assets').remove([storagePath]);
    return json({ error: insertError?.code === '23505' ? 'Esta posición de foto ya fue utilizada.' : 'No se pudo registrar la foto.' }, 409);
  }

  return json({ id: image.id, imageUrl: image.image_url, sortOrder: image.sort_order });
});
