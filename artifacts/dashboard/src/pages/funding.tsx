import { useListFunding, getListFundingQueryKey } from "@workspace/api-client-react";
import { formatTime, formatDate, formatPercent } from "@/lib/format";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export default function FundingPage() {
  const { data: funding, isLoading } = useListFunding(
    { symbol: "BTC/USDT", limit: 100 },
    { query: { queryKey: getListFundingQueryKey({ symbol: "BTC/USDT", limit: 100 }), refetchInterval: 30000 } }
  );

  const chartData = [...(funding || [])].reverse().map(d => ({
    time: formatTime(d.timestamp),
    rate: d.fundingRate * 100, // Convert to percentage for display
  }));

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Funding Rates</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Perpetual Funding History</p>
        </div>
      </div>

      <div className="h-64 border bg-card p-4 rounded-sm shrink-0">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center font-mono text-sm text-muted-foreground">Loading chart...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="time" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(val) => `${val.toFixed(4)}%`}
                width={80}
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'var(--app-font-mono)'}} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}
                formatter={(val: number) => [`${val.toFixed(4)}%`, 'Rate']}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <Line type="stepAfter" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border bg-card rounded-sm flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm font-mono text-left relative">
            <thead className="sticky top-0 bg-card border-b z-10 shadow-sm">
              <tr>
                <th className="p-3 font-normal text-muted-foreground">Timestamp</th>
                <th className="p-3 font-normal text-muted-foreground text-right">Funding Rate</th>
                <th className="p-3 font-normal text-muted-foreground">Next Funding Time</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="p-4 text-center">Loading data...</td></tr>
              ) : funding?.map(row => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                  <td className="p-3 text-muted-foreground">{formatDate(row.timestamp)}</td>
                  <td className={`p-3 text-right font-bold ${row.fundingRate > 0 ? 'text-bull' : row.fundingRate < 0 ? 'text-bear' : ''}`}>
                    {formatPercent(row.fundingRate, 6)}
                  </td>
                  <td className="p-3">{row.nextFundingTime ? formatDate(row.nextFundingTime) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
