import { useGetMarketSnapshot, useGetCollectorStatus, useGetSummaryOverview, getGetMarketSnapshotQueryKey, getGetCollectorStatusQueryKey, getGetSummaryOverviewQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatCompactNumber, formatPercent, formatDate } from "@/lib/format";

export default function Dashboard() {
  const { data: snapshot, isLoading: isLoadingSnapshot } = useGetMarketSnapshot(
    { symbol: "BTC/USDT" },
    { query: { queryKey: getGetMarketSnapshotQueryKey({ symbol: "BTC/USDT" }), refetchInterval: 30000 } }
  );

  const { data: collectorStatus, isLoading: isLoadingCollector } = useGetCollectorStatus(
    { query: { queryKey: getGetCollectorStatusQueryKey(), refetchInterval: 30000 } }
  );

  const { data: summary, isLoading: isLoadingSummary } = useGetSummaryOverview(
    { query: { queryKey: getGetSummaryOverviewQueryKey(), refetchInterval: 30000 } }
  );

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 overflow-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Overview</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Data Pipeline • Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Market Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border bg-card p-4 rounded-sm">
          <div className="text-xs text-muted-foreground mb-1">CURRENT PRICE</div>
          <div className="text-2xl font-mono font-bold">
            {isLoadingSnapshot ? "-" : formatCurrency(snapshot?.currentPrice)}
          </div>
          <div className={`text-xs mt-2 font-mono ${snapshot?.priceChange1h && snapshot.priceChange1h > 0 ? 'text-bull' : 'text-bear'}`}>
            {snapshot?.priceChange1h ? `${snapshot.priceChange1h > 0 ? '+' : ''}${formatPercent(snapshot.priceChange1h)} 1h` : '-'}
          </div>
        </div>
        
        <div className="border bg-card p-4 rounded-sm">
          <div className="text-xs text-muted-foreground mb-1">FUNDING RATE</div>
          <div className={`text-2xl font-mono font-bold ${snapshot?.fundingRate && snapshot.fundingRate > 0 ? 'text-bull' : snapshot?.fundingRate && snapshot.fundingRate < 0 ? 'text-bear' : ''}`}>
            {isLoadingSnapshot ? "-" : formatPercent(snapshot?.fundingRate, 4)}
          </div>
          <div className="text-xs mt-2 font-mono text-muted-foreground">
            Current Term
          </div>
        </div>

        <div className="border bg-card p-4 rounded-sm">
          <div className="text-xs text-muted-foreground mb-1">OPEN INTEREST</div>
          <div className="text-2xl font-mono font-bold">
            {isLoadingSnapshot ? "-" : formatCompactNumber(snapshot?.openInterest)}
          </div>
          <div className="text-xs mt-2 font-mono text-muted-foreground">
            Val: {formatCurrency(snapshot?.openInterestValue)}
          </div>
        </div>

        <div className="border bg-card p-4 rounded-sm">
          <div className="text-xs text-muted-foreground mb-1">1H LIQUIDATIONS</div>
          <div className="text-2xl font-mono font-bold text-destructive">
            {isLoadingSnapshot ? "-" : formatCurrency(snapshot?.liquidationsValue1h)}
          </div>
          <div className="text-xs mt-2 font-mono text-muted-foreground">
            {formatCompactNumber(snapshot?.liquidations1h)} events
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collector Status Grid */}
        <div className="border bg-card rounded-sm flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-muted/30">
            <h3 className="font-bold text-sm tracking-widest">COLLECTOR_STATUS</h3>
            <span className="text-xs font-mono bg-primary/20 text-primary px-2 py-1 rounded-sm">{collectorStatus?.collectors?.length || 0} MODULES</span>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="p-3 font-normal text-muted-foreground">Module</th>
                  <th className="p-3 font-normal text-muted-foreground">Status</th>
                  <th className="p-3 font-normal text-muted-foreground">Last Run</th>
                  <th className="p-3 font-normal text-muted-foreground">Records</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingCollector ? (
                  <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
                ) : collectorStatus?.collectors?.map(c => (
                  <tr key={c.name} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold">{c.name}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-sm text-xs ${c.status === 'OK' ? 'bg-bull/20 text-bull' : 'bg-bear/20 text-bear'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDate(c.lastRun)}</td>
                    <td className="p-3">{formatNumber(c.recordCount, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Summary */}
        <div className="border bg-card rounded-sm flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-muted/30">
            <h3 className="font-bold text-sm tracking-widest">DB_STATISTICS</h3>
            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-sm border">TOTAL: {formatCompactNumber(summary?.totalRecords)} REC</span>
          </div>
          <div className="p-0 flex-1 overflow-auto">
            <table className="w-full text-sm font-mono text-left">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="p-3 font-normal text-muted-foreground">Table</th>
                  <th className="p-3 font-normal text-muted-foreground">Count</th>
                  <th className="p-3 font-normal text-muted-foreground">Data Age</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingSummary ? (
                  <tr><td colSpan={3} className="p-4 text-center">Loading...</td></tr>
                ) : summary?.tables?.map(t => (
                  <tr key={t.table} className="border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors">
                    <td className="p-3 font-bold">{t.table}</td>
                    <td className="p-3">{formatNumber(t.recordCount, 0)}</td>
                    <td className="p-3 text-muted-foreground">
                      {t.dataAgeMinutes !== null && t.dataAgeMinutes !== undefined ? (
                        t.dataAgeMinutes < 2 ? <span className="text-bull">Live (&lt;2m)</span> : `${Math.round(t.dataAgeMinutes)}m ago`
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
