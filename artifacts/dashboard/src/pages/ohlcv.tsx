import { useState } from "react";
import { useListOhlcv, getListOhlcvQueryKey, ListOhlcvTimeframe } from "@workspace/api-client-react";
import { formatCurrency, formatNumber, formatTime, formatDate } from "@/lib/format";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function OhlcvPage() {
  const [timeframe, setTimeframe] = useState<ListOhlcvTimeframe>('1m');

  const { data: ohlcv, isLoading } = useListOhlcv(
    { symbol: "BTC/USDT", timeframe, limit: 100 },
    { query: { queryKey: getListOhlcvQueryKey({ symbol: "BTC/USDT", timeframe, limit: 100 }), refetchInterval: 30000 } }
  );

  const chartData = [...(ohlcv || [])].reverse().map(d => ({
    time: formatTime(d.timestamp),
    price: d.close,
    isBull: d.close >= d.open
  }));

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 h-full overflow-hidden">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">OHLCV Data</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">BTC/USDT Candlestick records</p>
        </div>
        
        <div className="flex bg-muted p-1 rounded-sm border">
          {(['1m', '5m', '15m', '1h'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-4 py-1 text-sm font-mono transition-colors rounded-sm ${timeframe === tf ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="h-48 border bg-card p-4 rounded-sm shrink-0">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center font-mono text-sm text-muted-foreground">Loading chart...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'var(--app-font-mono)', fontSize: '12px' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="price" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPrice)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border bg-card rounded-sm flex-1 flex flex-col min-h-0">
        <div className="p-0 overflow-auto flex-1 relative">
          <table className="w-full text-sm font-mono text-right relative">
            <thead className="sticky top-0 bg-card border-b z-10 shadow-sm">
              <tr>
                <th className="p-3 font-normal text-muted-foreground text-left">Time</th>
                <th className="p-3 font-normal text-muted-foreground">Open</th>
                <th className="p-3 font-normal text-muted-foreground">High</th>
                <th className="p-3 font-normal text-muted-foreground">Low</th>
                <th className="p-3 font-normal text-muted-foreground">Close</th>
                <th className="p-3 font-normal text-muted-foreground">Volume</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="p-4 text-center text-left">Loading data...</td></tr>
              ) : ohlcv?.map(row => {
                const isBull = row.close >= row.open;
                return (
                  <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20">
                    <td className="p-3 text-left text-muted-foreground">{formatDate(row.timestamp)}</td>
                    <td className="p-3">{formatCurrency(row.open)}</td>
                    <td className="p-3">{formatCurrency(row.high)}</td>
                    <td className="p-3">{formatCurrency(row.low)}</td>
                    <td className={`p-3 font-bold ${isBull ? 'text-bull' : 'text-bear'}`}>{formatCurrency(row.close)}</td>
                    <td className="p-3">{formatNumber(row.volume)}</td>
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
