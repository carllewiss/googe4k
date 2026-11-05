// db-backup: admin-only database export to CSV files in the private `backups` bucket.
// Actions: start | table | finish
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function csvField(v: unknown): string {
  if (v === null || v === undefined) return ''
  // JSON-encode then CSV-quote so restore can reconstruct typed values exactly
  return '"' + JSON.stringify(v).replace(/"/g, '""') + '"'
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = []
  lines.push(columns.map((c) => '"' + c + '"').join(','))
  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c])).join(','))
  }
  return lines.join('\n') + '\n'
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) throw new Error('Not signed in')
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(authHeader.replace('Bearer ', ''))
  if (userErr || !userData.user) throw new Error('Invalid session')
  const { data: roles, error: roleErr } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id)
  if (roleErr) throw new Error('Could not verify permissions')
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) throw new Error('Only admins can run backups')
  return { admin, user: userData.user }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const { admin, user } = await requireAdmin(req)
    const body = await req.json()

    if (body.action === 'start') {
      // Ordered table list with row estimates and columns comes from the DB itself
      const { data: manifest, error } = await admin.rpc('backup_manifest', { p_user_id: user.id })
      if (error || !manifest) throw new Error('Could not build backup manifest: ' + (error?.message ?? ''))
      const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID().slice(0, 8)
      const tables = (manifest as { table_name: string; restore_order: number; row_estimate: string | number; columns: unknown }[])
        .sort((a, b) => a.restore_order - b.restore_order)
        .map((t) => ({ table: t.table_name, restore_order: t.restore_order, row_estimate: Number(t.row_estimate), columns: t.columns }))
      const manifestObj = { run_id: runId, created_at: new Date().toISOString(), created_by: user.id, tables }
      const { error: upErr } = await admin.storage
        .from('backups')
        .upload(`${runId}/manifest.json`, JSON.stringify(manifestObj), { contentType: 'application/json', upsert: true })
      if (upErr) throw new Error('Could not save manifest: ' + upErr.message)
      const { error: histErr } = await admin.from('backup_history').insert({
        kind: 'manual',
        target: 'cloud-storage',
        file_name: runId,
        table_count: tables.length,
        status: 'running',
        created_by: user.id,
      })
      if (histErr) throw new Error('Could not log backup: ' + histErr.message)
      return new Response(JSON.stringify({ ok: true, run_id: runId, tables }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'table') {
      const runId = String(body.run_id ?? '')
      const table = String(body.table ?? '')
      if (!/^[a-zA-Z0-9_]+$/.test(table)) throw new Error('Invalid table name')
      if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('Invalid run id')
      const manifestObj = await admin.storage.from('backups').download(`${runId}/manifest.json`)
      if (manifestObj.error) throw new Error('Manifest not found: ' + manifestObj.error.message)
      const manifest = JSON.parse(await manifestObj.data.text()) as { tables: { table: string; columns: { name: string }[] }[] }
      const entry = manifest.tables.find((t) => t.table === table)
      if (!entry) throw new Error('Table not in manifest')
      const columns = entry.columns.map((c) => c.name)

      // Export in pages of 5000 rows ordered by id
      const chunks: string[] = []
      let offset = 0
      let total = 0
      for (;;) {
        const { data, error } = await admin
          .from(table)
          .select('*')
          .order('id', { ascending: true })
          .range(offset, offset + 4999)
        if (error) throw new Error(`Could not read ${table}: ` + error.message)
        const rows = (data ?? []) as Record<string, unknown>[]
        if (rows.length === 0) break
        chunks.push(rows.map((r) => columns.map((c) => csvField(r[c])).join(',')).join('\n') + '\n')
        total += rows.length
        if (rows.length < 5000) break
        offset += 5000
      }
      const csv = columns.map((c) => '"' + c + '"').join(',') + '\n' + chunks.join('')
      const { error: upErr } = await admin.storage
        .from('backups')
        .upload(`${runId}/${table}.csv`, csv, { contentType: 'text/csv', upsert: true })
      if (upErr) throw new Error(`Could not save ${table}.csv: ` + upErr.message)
      return new Response(JSON.stringify({ ok: true, table, rows: total, bytes: csv.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'finish') {
      const runId = String(body.run_id ?? '')
      if (!/^[a-zA-Z0-9._-]+$/.test(runId)) throw new Error('Invalid run id')
      const { data: files, error: listErr } = await admin.storage.from('backups').list(runId)
      if (listErr) throw new Error('Could not list backup files: ' + listErr.message)
      let totalBytes = 0
      let tableCount = 0
      for (const f of files ?? []) {
        if (f.name === 'manifest.json') continue
        totalBytes += f.metadata?.size ?? 0
        tableCount++
      }
      const { data: hist, error: histErr } = await admin
        .from('backup_history')
        .select('id, row_count')
        .eq('file_name', runId)
        .maybeSingle()
      if (histErr || !hist) throw new Error('Backup log entry not found')
      // row_count was carried per table call by the client
      const { error: updErr } = await admin
        .from('backup_history')
        .update({ status: 'success', size_bytes: totalBytes, table_count: tableCount, row_count: body.row_count ?? hist.row_count ?? null })
        .eq('id', hist.id)
      if (updErr) throw new Error('Could not finalize backup: ' + updErr.message)
      return new Response(JSON.stringify({ ok: true, size_bytes: totalBytes, table_count: tableCount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'fail') {
      const runId = String(body.run_id ?? '')
      await admin.from('backup_history').update({ status: 'failed', error: String(body.error ?? 'unknown') }).eq('file_name', runId)
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
