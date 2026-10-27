// Forest Club Urla · Edge Function'ların ortak parçaları: CORS, JSON yanıt, service_role istemcisi, zamanlayıcı
// anahtarı ve demo adresi denetimi.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(durum: number, govde: unknown): Response {
  return new Response(JSON.stringify(govde), { status: durum, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });
}

// Veritabanına service_role ile bağlanır (SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY Supabase'de hazır gelir)
export function servisIstemcisi(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// pg_cron'dan gelen çağrı: x-zamanlayici başlığı ZAMANLAYICI_ANAHTARI ile aynı olmalı (sabit süreli karşılaştırma)
export function zamanlayiciMi(istek: Request): boolean {
  const beklenen = Deno.env.get('ZAMANLAYICI_ANAHTARI') || '';
  const gelen = istek.headers.get('x-zamanlayici') || '';
  if (beklenen.length < 16 || gelen.length !== beklenen.length) return false;
  let fark = 0;
  for (let i = 0; i < beklenen.length; i++) fark |= beklenen.charCodeAt(i) ^ gelen.charCodeAt(i);
  return fark === 0;
}

export { demoAdresMi } from './sablon.ts';
