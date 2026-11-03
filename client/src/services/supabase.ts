import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StudioJob } from '../types';

let supabaseClient: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = 'https://eylkbycxhptmmqcpvloz.supabase.co';

export function getSupabaseClient(anonKey?: string): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('swa_supabase_anon_key') || '';

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

export function setCustomSupabaseKey(key: string): void {
  localStorage.setItem('swa_supabase_anon_key', key);
  supabaseClient = null; // reset client to re-initialize
}

export async function syncRunToSupabase(job: StudioJob): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client not configured with Anon Key' };
  }

  try {
    const { error } = await client.from('jewellery_runs').upsert({
      job_id: job.jobId,
      sku: job.sku || 'SWA',
      diamond_count: job.diamondCount,
      count_for: job.countFor,
      original_summary: job.original.summary,
      created_at: new Date(job.createdAt).toISOString(),
      variations_json: job.variations,
    });

    if (error) {
      console.warn('Supabase sync table error (table may need to be created):', error.message);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Sync error' };
  }
}
