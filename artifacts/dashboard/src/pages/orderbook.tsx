import { useListOrderbook, getListOrderbookQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";

export default function OrderbookPage() {
  const { data: orderbooks, isLoading } = useListOrderbook(
    { symbol: "BTC/USDT", limit: 50 },
    { query: { queryKey: getListOrderbookQueryKey({ symbol: "BTC/USDT", limit: 50 }), refetchInterval: 10000 } }
  );

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Orderbook Snapshots</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Depth & Liquidity</p>
        </div>
      </div>

      <div className="border bg-card rounded-sm flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm font-mono text-right relative">
            <thead className="sticky top-0 bg-card border-b z-10 shadow-sm">
              <tr>
                <th className="p-3 font-normal text-muted-foreground text-left">Time</th>
                <th className="p-3 font-normal text-muted-foreground">Mid Price</th>
                <th className="p-3 font-normal text-muted-foreground">Spread</th>
                <th className="p-3 font-normal text-muted-foreground text-center">B/A Ratio</th>
                <th className="p-3 font-normal text-muted-foreground">Visual</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="p-4 text-center text-left">Loading data...</td></tr>
              ) : orderbooks?.map(row => {
                const ratio = row.bidAskRatio;
                const totalBar = 100;
                const bidPct = Math.min(Math.max((ratio / (1 + ratio)) * 100, 5), 95);
                
                return (
                  <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                    <td className="p-3 text-left text-muted-foreground">{formatDate(row.timestamp)}</td>
                    <td className="p-3 font-bold">{formatCurrency(row.midPrice)}</td>
                    <td className="p-3">{formatCurrency(row.spread)}</td>
                    <td className="p-3 text-center">
                      <span className={ratio > 1 ? 'text-bull' : ratio < 1 ? 'text-bear' : ''}>
                        {formatNumber(ratio, 2)}x
                      </span>
                    </td>
                    <td className="p-3 w-48 align-middle">
                      <div className="h-1.5 w-full bg-muted flex rounded-full overflow-hidden">
                        <div className="h-full bg-bull" style={{ width: `${bidPct}%` }}></div>
                        <div className="h-full bg-bear" style={{ width: `${100 - bidPct}%` }}></div>
                      </div>
                    </td>
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
