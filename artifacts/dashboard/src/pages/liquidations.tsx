import { useListLiquidations, getListLiquidationsQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { Search } from "lucide-react";

export default function LiquidationsPage() {
  const { data: liquidations, isLoading } = useListLiquidations(
    { symbol: "BTC/USDT", limit: 100 },
    { query: { queryKey: getListLiquidationsQueryKey({ symbol: "BTC/USDT", limit: 100 }), refetchInterval: 10000 } }
  );

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Liquidations</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Real-time liquidation events</p>
        </div>
      </div>

      <div className="border bg-card rounded-sm flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm font-mono text-right relative">
            <thead className="sticky top-0 bg-card border-b z-10 shadow-sm">
              <tr>
                <th className="p-3 font-normal text-muted-foreground text-left">Time</th>
                <th className="p-3 font-normal text-muted-foreground text-center">Side</th>
                <th className="p-3 font-normal text-muted-foreground">Price</th>
                <th className="p-3 font-normal text-muted-foreground">Quantity</th>
                <th className="p-3 font-normal text-muted-foreground">Notional Value</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-4 text-center text-left">Loading data...</td></tr>
              ) : liquidations?.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground"><Search className="mx-auto mb-2 opacity-50"/> No liquidations in the recorded window</td></tr>
              ) : liquidations?.map(row => {
                const isLong = row.side === 'LONG';
                return (
                  <tr key={row.id} className={`border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors`}>
                    <td className="p-3 text-left text-muted-foreground">{formatDate(row.timestamp)}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-sm text-xs font-bold ${isLong ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'}`}>
                        {row.side}
                      </span>
                    </td>
                    <td className="p-3">{formatCurrency(row.price)}</td>
                    <td className="p-3">{formatNumber(row.quantity, 4)}</td>
                    <td className="p-3 font-bold">{formatCurrency(row.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
