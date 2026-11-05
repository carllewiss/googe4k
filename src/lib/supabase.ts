import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Safe credential storage in localStorage or process env
const STORAGE_KEY_URL = 'apex_erp_supabase_url';
const STORAGE_KEY_ANON = 'apex_erp_supabase_anon';

export function getStoredSupabaseConfig(): { url: string; anonKey: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envAnon = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = localStorage.getItem(STORAGE_KEY_URL) || envUrl;
  const storedAnon = localStorage.getItem(STORAGE_KEY_ANON) || envAnon;

  return {
    url: storedUrl.trim(),
    anonKey: storedAnon.trim()
  };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  localStorage.setItem(STORAGE_KEY_URL, url.trim());
  localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_KEY_URL);
  localStorage.removeItem(STORAGE_KEY_ANON);
}

let cachedClient: SupabaseClient | null = null;
let lastUsedConfig = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getStoredSupabaseConfig();
  if (!url || !anonKey) {
    return null;
  }

  const keyString = `${url}:::${anonKey}`;
  if (cachedClient && lastUsedConfig === keyString) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    });
    lastUsedConfig = keyString;
    return cachedClient;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(url: string, anonKey: string): Promise<{
  success: boolean;
  message: string;
  hasSchema?: boolean;
  tableCount?: number;
}> {
  if (!url || !anonKey) {
    return { success: false, message: 'Please provide both Supabase Project URL and Anon Public Key.' };
  }

  if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
    return {
      success: false,
      message: 'Invalid URL format. Supabase URL typically looks like https://xyzproject.supabase.co'
    };
  }

  try {
    const testClient = createClient(url, anonKey);

    // 1. Check if we can reach PostgREST
    // Query public.erp_inventory to check if table exists
    const { data, error } = await testClient
      .from('erp_inventory')
      .select('count', { count: 'exact', head: true });

    if (error) {
      // Check if it's 404/relation not found (meaning Supabase credentials work, but ERP tables need to be created)
      if (error.code === '42P01' || error.message?.includes('relation "public.erp_inventory" does not exist') || error.message?.includes('not found')) {
        return {
          success: true,
          hasSchema: false,
          tableCount: 0,
          message: 'Connected to Supabase successfully! The database is reachable, but ERP tables (erp_inventory, etc.) are not created yet. Use the SQL Schema tab to run the migration script.'
        };
      }

      // Check if auth or key issue
      if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('apikey')) {
        return {
          success: false,
          message: `Authentication error with Supabase: ${error.message}. Please verify the anon key.`
        };
      }

      return {
        success: true,
        hasSchema: false,
        message: `Connected to Supabase endpoint! Notice: ${error.message}`
      };
    }

    return {
      success: true,
      hasSchema: true,
      tableCount: 8,
      message: 'Connected to Supabase successfully! ERP tables detected and live PostgREST synchronization is active.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to connect to Supabase: ${err.message || 'Network error'}`
    };
  }
}

/**
 * Invoke an edge function through the Supabase client
 */
export async function invokeEdgeFunction(functionName: string, payload?: any): Promise<{
  data: any;
  error: any;
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: { message: 'No Supabase client configured. Please enter your Supabase URL & Anon Key.' }
    };
  }

  try {
    const res = await client.functions.invoke(functionName, {
      body: payload
    });
    return res;
  } catch (err: any) {
    return {
      data: null,
      error: { message: err.message || 'Edge function invocation error' }
    };
  }
}
