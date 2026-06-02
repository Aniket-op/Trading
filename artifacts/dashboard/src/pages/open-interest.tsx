import { useListOpenInterest, getListOpenInterestQueryKey } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatTime, formatDate } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function OpenInterestPage() {
  const { data: openInterest, isLoading } = useListOpenInterest(
    { symbol: "BTC/USDT", limit: 100 },
    { query: { queryKey: getListOpenInterestQueryKey({ symbol: "BTC/USDT", limit: 100 }), refetchInterval: 30000 } }
  );

  const chartData = [...(openInterest || [])].reverse().map(d => ({
    time: formatTime(d.timestamp),
    oi: d.openInterest,
    value: d.openInterestValue
  }));

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Open Interest</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Perpetual OI tracking</p>
        </div>
      </div>

      <div className="h-64 border bg-card p-4 rounded-sm shrink-0">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center font-mono text-sm text-muted-foreground">Loading chart...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="time" hide />
              <YAxis 
                domain={['auto', 'auto']} 
                tickFormatter={(val) => (val / 1000).toFixed(1) + 'k'}
                width={60}
                tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12, fontFamily: 'var(--app-font-mono)'}} 
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}
                formatter={(val: number) => [formatNumber(val, 2), 'OI (BTC)']}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                cursor={{fill: 'hsl(var(--muted))', opacity: 0.2}}
              />
              <Bar dataKey="oi" isAnimationActive={false}>
                {chartData.map((entry, index) => {
                  const prev = index > 0 ? chartData[index - 1].oi : entry.oi;
                  return <Cell key={`cell-${index}`} fill={entry.oi >= prev ? "hsl(var(--primary))" : "hsl(var(--chart-4))"} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border bg-card rounded-sm flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm font-mono text-right relative">
            <thead className="sticky top-0 bg-card border-b z-10 shadow-sm">
              <tr>
                <th className="p-3 font-normal text-muted-foreground text-left">Timestamp</th>
                <th className="p-3 font-normal text-muted-foreground">Open Interest (BTC)</th>
                <th className="p-3 font-normal text-muted-foreground">Notional Value (USDT)</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={3} className="p-4 text-center text-left">Loading data...</td></tr>
              ) : openInterest?.map(row => (
                <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                  <td className="p-3 text-left text-muted-foreground">{formatDate(row.timestamp)}</td>
                  <td className="p-3 font-bold">{formatNumber(row.openInterest, 3)}</td>
                  <td className="p-3">{formatCurrency(row.openInterestValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
