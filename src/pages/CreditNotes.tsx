import { useMemo, useState } from "react";
import { useCreditNotes, useReprintCreditNote } from "@/hooks/useCreditNotes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Printer } from "lucide-react";
import { CreditNotePrintView } from "@/components/CreditNotePrintView";
import { VirtualizedTable } from "@/components/VirtualizedTable";
import { ColumnDef } from "@tanstack/react-table";
import { printDocument } from "@/lib/print";
import { toast } from "sonner";

export default function CreditNotes() {
  const { data: notes = [], isLoading } = useCreditNotes();
  const reprint = useReprintCreditNote();
  const [printData, setPrintData] = useState<any>(null);

  const openPrint = async (cn: any, asReprint: boolean) => {
    let count = cn.reprint_count || 0;
    if (asReprint) {
      try { count = await reprint.mutateAsync(cn.id); }
      catch (e: any) { toast.error(e.message); return; }
    }
    setPrintData({
      creditNoteNumber: cn.credit_note_number,
      invoiceNumber: cn.invoices?.invoice_number || "—",
      customerName: cn.customers?.name || "—",
      customerPin: null,
      date: cn.created_at,
      reason: cn.reason,
      items: (cn.credit_note_items || []).map((it: any) => ({
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: Number(it.unit_price),
        total: Number(it.total),
        is_service: it.is_service,
      })),
      subtotal: Number(cn.subtotal),
      tax: Number(cn.tax),
      total: Number(cn.total),
      refundMethod: cn.refund_method,
      refundAmount: Number(cn.refund_amount),
      isReprint: asReprint || (cn.reprint_count || 0) > 0,
      reprintCount: count,
    });
  };

  const columns = useMemo<ColumnDef<any>[]>(() => [
    {
      accessorKey: "credit_note_number",
      header: "CN #",
      size: 130,
      cell: ({ row }) => (
        <span className="font-medium text-sm">
          {row.original.credit_note_number}
          {(row.original.reprint_count || 0) > 0 && (
            <Badge variant="outline" className="ml-2 text-[10px] text-destructive border-destructive/30">
              REPRINT ×{row.original.reprint_count}
            </Badge>
          )}
        </span>
      ),
    },
    {
      id: "invoice",
      header: "Invoice",
      cell: ({ row }) => <span className="text-sm">{row.original.invoices?.invoice_number || "—"}</span>,
    },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => <span className="text-sm">{row.original.customers?.name || "—"}</span>,
    },
    {
      accessorKey: "created_at",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(row.original.created_at), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      accessorKey: "total",
      header: () => <span className="block text-right w-full">Total</span>,
      cell: ({ row }) => (
        <div className="text-right text-sm">KES {Number(row.original.total).toLocaleString()}</div>
      ),
    },
    {
      accessorKey: "refund_method",
      header: "Settlement",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize text-xs">
          {String(row.original.refund_method).replace("_", " ")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: () => <span className="block text-right w-full">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="text-right">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openPrint(row.original, (row.original.reprint_count || 0) > 0); }}>
            <Printer className="h-3 w-3 mr-1" /> Print
          </Button>
        </div>
      ),
    },
  ], []);

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold font-heading">Credit Notes</h1>
      <Card>
        <CardContent className="p-0">
          <VirtualizedTable data={notes} columns={columns} rowHeight={48} height="70vh"
            empty="No credit notes yet. Issue one from an invoice." />
        </CardContent>
      </Card>

      <Dialog open={!!printData} onOpenChange={(o) => !o && setPrintData(null)}>
        <DialogContent className="max-w-4xl p-0 max-h-[90vh] overflow-auto">
          {printData && (
            <>
              <CreditNotePrintView {...printData} />
              <div className="p-3 border-t flex justify-end gap-2 sticky bottom-0 bg-background">
                <Button variant="outline" onClick={() => setPrintData(null)}>Close</Button>
                <Button onClick={() => printDocument()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
