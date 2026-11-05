import { useRef, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  /** Approx row height in px. Smaller = denser. */
  rowHeight?: number;
  /** Container height (CSS). Default 65vh. */
  height?: string;
  /** Click handler for row */
  onRowClick?: (row: T) => void;
  /** Empty-state node */
  empty?: React.ReactNode;
  /** Extra row class — receives row data */
  rowClassName?: (row: T) => string;
}

/**
 * Virtualized desktop-ERP table backed by TanStack Table + Virtualizer.
 * Sticky header, sortable columns (click header), smooth scroll on 10k+ rows.
 */
export function VirtualizedTable<T>({
  data,
  columns,
  rowHeight = 44,
  height = "65vh",
  onRowClick,
  empty,
  rowClassName,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        {empty ?? "No records."}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="relative w-full overflow-auto border-t"
      style={{ height }}
    >
      <table className="w-full caption-bottom text-sm border-separate border-spacing-0">
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b">
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className={cn(
                      "h-9 px-3 text-left align-middle text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b",
                      canSort && "cursor-pointer select-none hover:text-foreground"
                    )}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && (
                        <span className="opacity-60">
                          {sorted === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ChevronsUpDown className="h-3 w-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 && (
            <tr>
              <td style={{ height: paddingTop }} colSpan={columns.length} />
            </tr>
          )}
          {virtualRows.map((vr) => {
            const row = rows[vr.index];
            return (
              <tr
                key={row.id}
                data-index={vr.index}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cn(
                  "border-b transition-colors hover:bg-muted/40",
                  onRowClick && "cursor-pointer",
                  rowClassName?.(row.original)
                )}
                style={{ height: rowHeight }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 align-middle border-b text-sm"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td style={{ height: paddingBottom }} colSpan={columns.length} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
