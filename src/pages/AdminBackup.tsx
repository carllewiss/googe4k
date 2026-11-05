import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, DatabaseBackup, RotateCcw, Loader2, ShieldAlert } from "lucide-react";

interface BackupTable {
  table: string;
  restore_order: number;
  row_estimate: number;
}

interface HistoryRow {
  id: string;
  kind: string;
  target: string;
  file_name: string;
  size_bytes: number | null;
  table_count: number | null;
  row_count: number | null;
  status: string;
  error: string | null;
  created_at: string;
}

function fmtBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

async function invokeFn<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) throw new Error(error.message);
  const payload = data as T & { error?: string };
  if (payload?.error) throw new Error(payload.error);
  return payload;
}

export default function AdminBackup() {
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<HistoryRow | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoringStep, setRestoringStep] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("backup_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error) setHistory((data ?? []) as HistoryRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const runBackup = async () => {
    if (backingUp) return;
    setBackingUp(true);
    try {
      const start = await invokeFn<{ run_id: string; tables: BackupTable[] }>("db-backup", { action: "start" });
      let totalRows = 0;
      for (let i = 0; i < start.tables.length; i++) {
        const t = start.tables[i];
        setProgress({ done: i, total: start.tables.length, current: t.table });
        const res = await invokeFn<{ rows: number }>("db-backup", { action: "table", run_id: start.run_id, table: t.table });
        totalRows += res.rows;
      }
      setProgress({ done: start.tables.length, total: start.tables.length, current: "finalizing" });
      await invokeFn("db-backup", { action: "finish", run_id: start.run_id, row_count: totalRows });
      toast.success(`Backup complete — ${start.tables.length} tables, ${totalRows.toLocaleString()} rows`);
      loadHistory();
    } catch (e) {
      toast.error(`Backup failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBackingUp(false);
      setProgress({ done: 0, total: 0, current: "" });
    }
  };

  const downloadBackup = async (row: HistoryRow) => {
    setDownloading(row.file_name);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const { data: files, error } = await supabase.storage.from("backups").list(row.file_name);
      if (error || !files?.length) throw new Error("Backup files not found");
      for (const f of files) {
        const { data: url, error: urlErr } = await supabase.storage
          .from("backups")
          .createSignedUrl(`${row.file_name}/${f.name}`, 3600);
        if (urlErr || !url) throw new Error(`Could not read ${f.name}`);
        const res = await fetch(url.signedUrl);
        const blob = await res.blob();
        zip.file(f.name, blob);
      }
      const out = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(out);
      a.download = `4k-smart-backup-${row.file_name}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error(`Download failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloading(null);
    }
  };

  const runRestore = async () => {
    if (!restoreTarget || restoring) return;
    setRestoring(true);
    try {
      const plan = await invokeFn<{ run_id: string; tables: BackupTable[]; missing: string[] }>("db-restore", {
        action: "plan",
        run_id: restoreTarget.file_name,
      });
      if (plan.missing.length > 0) throw new Error(`Backup is incomplete, missing: ${plan.missing.join(", ")}`);
      setRestoringStep("Clearing current data…");
      await invokeFn("db-restore", { action: "clear", run_id: plan.run_id });
      for (let i = 0; i < plan.tables.length; i++) {
        const t = plan.tables[i];
        setRestoringStep(`Restoring ${t.table} (${i + 1}/${plan.tables.length})…`);
        await invokeFn("db-restore", { action: "table", run_id: plan.run_id, table: t.table });
      }
      setRestoringStep("Finalizing…");
      await invokeFn("db-restore", { action: "finish", run_id: plan.run_id });
      toast.success("Database restored from backup");
      setRestoreOpen(false);
      loadHistory();
    } catch (e) {
      await supabase.functions.invoke("db-restore", {
        body: { action: "fail", run_id: restoreTarget.file_name, error: e instanceof Error ? e.message : String(e) },
      });
      toast.error(`Restore failed: ${e instanceof Error ? e.message : String(e)} — triggers were re-enabled`);
    } finally {
      setRestoring(false);
      setRestoringStep("");
    }
  };

  const totalEstimate = history
    .filter((h) => h.kind === "manual")
    .reduce((acc, h) => acc + (h.row_count ?? 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Database Backup & Restore</h1>
        <p className="text-muted-foreground text-sm">
          Export every table in the ERP, download it as a ZIP, or restore the database to a previous backup.
        </p>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 text-sm">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-amber-900">
          <p className="font-medium">What is included</p>
          <p>
            All application tables (customers, invoices, payments, journals, WiFi data, assets, settings and more) with
            their exact contents. Edge-function code lives in your website source, not the database.
          </p>
          <p className="mt-1">
            <span className="font-medium">Not included:</span> the stored API credentials (M-Pesa Daraja keys) — the
            system does not allow exporting them for security reasons. They stay working in place, and you can replace
            them anytime.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DatabaseBackup className="h-5 w-5" /> Create Backup
          </CardTitle>
          <CardDescription>Exports all tables to secure cloud storage. Runs a few minutes for a full export.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runBackup} disabled={backingUp}>
            {backingUp ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Backing up…
              </>
            ) : (
              "Create Backup Now"
            )}
          </Button>
          {backingUp && progress.total > 0 && (
            <div className="mt-4 space-y-2">
              <Progress value={(progress.done / progress.total) * 100} />
              <p className="text-xs text-muted-foreground">
                Table {progress.done + 1} of {progress.total}: {progress.current}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup History</CardTitle>
          <CardDescription>
            {totalEstimate > 0 && `${totalEstimate.toLocaleString()} rows backed up across ${history.filter((h) => h.kind === "manual").length} manual backups. `}
            Download any backup as a ZIP, or restore the database to it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No backups yet — create your first one above.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Tables</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">{fmtDate(row.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={row.kind === "restore" ? "outline" : "secondary"}>
                        {row.kind === "restore" ? "Restore" : "Backup"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{fmtBytes(row.size_bytes)}</TableCell>
                    <TableCell className="text-sm">{row.table_count ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "success" ? "default" : row.status === "running" ? "secondary" : "destructive"}>
                        {row.status}
                      </Badge>
                      {row.error && <p className="text-xs text-destructive mt-1">{row.error}</p>}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {row.kind === "manual" && row.status === "success" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadBackup(row)}
                            disabled={downloading === row.file_name}
                          >
                            {downloading === row.file_name ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            <span className="ml-1">ZIP</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setRestoreTarget(row);
                              setConfirmText("");
                              setRestoreOpen(true);
                            }}
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span className="ml-1">Restore</span>
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore database from backup?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This <span className="font-semibold">replaces everything currently in the system</span> with the
                  contents of the backup from {restoreTarget ? fmtDate(restoreTarget.created_at) : ""}. Anything recorded
                  after that backup is permanently lost.
                </p>
                <p>Do not use the app while the restore is running. It takes a few minutes.</p>
              </div>
            </AlertDialogDescription>
            <div className="py-2 space-y-2">
              <Label htmlFor="restore-confirm">
                Type <span className="font-mono font-bold">RESTORE</span> to confirm
              </Label>
              <Input
                id="restore-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                disabled={restoring}
              />
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirmText.trim() === "RESTORE") runRestore();
              }}
              disabled={restoring || confirmText.trim() !== "RESTORE"}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {restoring ? "Restoring…" : "Restore Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
          {restoring && restoringStep && (
            <p className="text-sm text-muted-foreground">{restoringStep}</p>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
