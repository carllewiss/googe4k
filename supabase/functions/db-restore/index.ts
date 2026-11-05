// db-restore: admin-only database restore from a backup run stored in the `backups` bucket.
// Actions: plan | clear | table | finish
// WARNING: replaces ALL rows in the application tables with the backup contents.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Manifest {
  run_id: string
  created_at: string
  tables: { table: string; restore_order: number; row_estimate: number; columns: { name: string; type: string }[] }[]
}

// Minimal RFC4180 CSV parser returning fields as strings ('' means NULL)
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else if (ch === '\r') {
      /* skip */
    } else field += ch
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function decodeField(s: string, cols: { name: string; type: string }[], idx: number): unknown {
  if (s === '') return null
  try {
    return JSON.parse(s)
  } catch {
    // Fallback: raw string
    return s
  }
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) throw new Error('Not signed in')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userErr || !userData.user) throw new Error('Invalid session')
  const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', userData.user.id)
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) throw new Error('Only admins can run restores')
  return { admin, user: userData.user, authHeader }
}

async function loadManifest(admin: ReturnType<typeof createClient>, runId: string): Promise<Manifest> {
  const dl = await admin.storage.from('backups').download(`${runId}/manifest.json`)
  if (dl.error) throw new Error('Backup manifest not found: ' + dl.error.message)
  return JSON.parse(await dl.data.text()) as Manifest
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { admin, user, authHeader } = await requireAdmin(req)
    const body = await req.json()

    if (body.action === 'plan') {
      const runId = String(body.run_id ?? '')
      if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('Invalid run id')
      const manifest = await loadManifest(admin, runId)
      const { data: files, error: listErr } = await admin.storage.from('backups').list(runId)
      if (listErr) throw new Error('Could not list backup files: ' + listErr.message)
      const present = new Set((files ?? []).map((f) => f.name))
      const missing = manifest.tables.filter((t) => !present.has(`${t.table}.csv`)).map((t) => t.table)
      return new Response(JSON.stringify({ ok: true, run_id: runId, created_at: manifest.created_at, tables: manifest.tables, missing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'clear') {
      const manifest = await loadManifest(admin, String(body.run_id ?? ''))
      // Turn off user triggers so no journals re-post and audit locks do not block
      const { error: trigErr } = await admin.rpc('restore_triggers', { p_user_id: user.id, p_disable: true })
      if (trigErr) throw new Error('Could not disable triggers: ' + trigErr.message)
      const names = manifest.tables.map((t) => `public."${t.table}"`).join(', ')
      const { error: truncErr } = await admin.rpc('restore_truncate', { p_tables: names })
      if (truncErr) throw new Error('Could not clear tables: ' + truncErr.message)
      return new Response(JSON.stringify({ ok: true, cleared: manifest.tables.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'table') {
      const runId = String(body.run_id ?? '')
      const table = String(body.table ?? '')
      if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('Invalid table name')
      const manifest = await loadManifest(admin, runId)
      const entry = manifest.tables.find((t) => t.table === table)
      if (!entry) throw new Error('Table not in manifest')
      const dl = await admin.storage.from('backups').download(`${runId}/${table}.csv`)
      if (dl.error) throw new Error(`Could not read ${table}.csv: ` + dl.error.message)
      const rows = parseCsv(await dl.data.text())
      if (rows.length === 0) return new Response(JSON.stringify({ ok: true, table, rows: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      const header = rows[0]
      const colTypes = new Map(entry.columns.map((c, i) => [c.name, i]))
      const insertRows: Record<string, unknown>[] = []
      for (let r = 1; r < rows.length; r++) {
        const raw = rows[r]
        if (raw.length === 1 && raw[0] === '') continue
        const obj: Record<string, unknown> = {}
        for (let c = 0; c < header.length; c++) {
          const name = header[c]
          const idx = colTypes.get(name)
          obj[name] = decodeField(raw[c] ?? '', entry.columns, idx ?? c)
        }
        insertRows.push(obj)
      }
      let inserted = 0
      const BATCH = 500
      for (let i = 0; i < insertRows.length; i += BATCH) {
        const batch = insertRows.slice(i, i + BATCH)
        const { error } = await admin.from(table).insert(batch)
        if (error) throw new Error(`Could not restore ${table} (rows ${i}-${i + batch.length}): ` + error.message)
        inserted += batch.length
      }
      return new Response(JSON.stringify({ ok: true, table, rows: inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'finish') {
      const { error: trigErr } = await admin.rpc('restore_triggers', { p_user_id: user.id, p_disable: false })
      if (trigErr) throw new Error('Could not re-enable triggers: ' + trigErr.message)
      const { error: histErr } = await admin.from('backup_history').insert({
        kind: 'restore',
        target: 'database',
        file_name: String(body.run_id ?? ''),
        status: 'success',
        created_by: user.id,
      })
      if (histErr) throw new Error('Could not log restore: ' + histErr.message)
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'fail') {
      // Make sure triggers come back on even if a restore failed midway
      await admin.rpc('restore_triggers', { p_user_id: user.id, p_disable: false })
      await admin.from('backup_history').insert({
        kind: 'restore',
        target: 'database',
        file_name: String(body.run_id ?? ''),
        status: 'failed',
        error: String(body.error ?? 'unknown'),
        created_by: user.id,
      })
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    throw new Error('Unknown action')
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
