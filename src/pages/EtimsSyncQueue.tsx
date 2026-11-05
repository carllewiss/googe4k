import { useState } from "react";
import { usePendingEtimsInvoices, useSyncEtimsInvoice } from "@/hooks/useEtims";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function EtimsSyncQueue() {
  const navigate = useNavigate();
  const { data: pending = [], isLoading, refetch } = usePendingEtimsInvoices();
  const { data: settings = {} } = useSystemSettings();
  const sync = useSyncEtimsInvoice();
  const [busyId, setBusyId] = useState<string | null>(null);

  const mode = settings.etims_mode || "sandbox";
  const deviceId = settings.etims_device_id || "";

  const handleSync = async (id: string, invNumber: string) => {
    setBusyId(id);
    try {
      await sync.mutateAsync(id);
      toast.success(`${invNumber} synced to KRA`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleSyncAll = async () => {
    for (const inv of pending) {
      await handleSync(inv.id, inv.invoice_number);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> eTIMS Sync Queue
            </h1>
            <p className="text-xs text-muted-foreground">
              Mode: <Badge variant="outline" className="ml-1 capitalize">{mode}</Badge>
              {deviceId ? <> · Device: <span className="font-mono">{deviceId}</span></> : <span className="text-warning ml-2">(no device ID configured)</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={handleSyncAll} disabled={pending.length === 0 || sync.isPending}>
            Sync All ({pending.length})
          </Button>
        </div>
      </div>

      {!deviceId && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
            <div>
              <p className="font-medium">eTIMS device not configured.</p>
              <p className="text-xs text-muted-foreground">
                Configure your KRA device ID in Settings. Real submission requires a provisioned OSCU device. This page currently uses a simulated signer for testing.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pending / Failed ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : pending.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              All invoices are synced ✓
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>KRA PIN</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((inv: any) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-bold text-primary">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm">{inv.customers?.name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs uppercase">{inv.customers?.kra_pin || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{new Date(inv.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right font-bold">KES {Number(inv.total).toLocaleString()}</TableCell>
                    <TableCell>
                      {inv.etims_status === "failed" ? (
                        <Badge className="bg-destructive/10 text-destructive">Failed</Badge>
                      ) : (
                        <Badge className="bg-warning/10 text-warning">Pending</Badge>
                      )}
                      {inv.etims_error && (
                        <p className="text-[10px] text-destructive mt-1 max-w-xs truncate" title={inv.etims_error}>
                          {inv.etims_error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === inv.id}
                        onClick={() => handleSync(inv.id, inv.invoice_number)}
                      >
                        {busyId === inv.id ? "Syncing..." : "Sync to KRA"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
