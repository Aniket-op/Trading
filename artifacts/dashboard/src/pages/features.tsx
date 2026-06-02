import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetLatestFeatures, useListFeatures, getListFeaturesQueryKey, getGetLatestFeaturesQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";

export default function FeaturesPage() {
  const symbol = "BTC/USDT";
  
  const { data: latestFeatures, isLoading: isLoadingLatest } = useGetLatestFeatures(
    { symbol },
    { query: { queryKey: getGetLatestFeaturesQueryKey({ symbol }), refetchInterval: 30000 } }
  );

  const { data: historyData, isLoading: isLoadingHistory } = useListFeatures(
    { symbol, limit: 100 },
    { query: { queryKey: getListFeaturesQueryKey({ symbol, limit: 100 }), refetchInterval: 30000 } }
  );

  const formatPercent = (val?: number | null) => val != null ? `${(val * 100).toFixed(2)}%` : "-";
  const formatEntropy = (val?: number | null) => val != null ? val.toFixed(3) : "-";
  const formatPrice = (val?: number | null) => val != null ? val.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : "-";
  const formatNumber = (val?: number | null, decimals = 2) => val != null ? val.toFixed(decimals) : "-";
  const formatLargeNum = (val?: number | null) => {
    if (val == null) return "-";
    const absVal = Math.abs(val);
    if (absVal >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
    if (absVal >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  const chartData = useMemo(() => {
    if (!historyData) return [];
    return [...historyData].reverse().map(d => ({
      ...d,
      timeLabel: format(new Date(d.timestamp), "HH:mm"),
      rVol24: d.realizedVol24h ? d.realizedVol24h * 100 : null,
      pVol24: d.parkinsonVol24h ? d.parkinsonVol24h * 100 : null,
    }));
  }, [historyData]);

  const latest = latestFeatures?.latest;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feature Store</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Computed ML signals for {symbol}</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Latest Signal Snapshot</h2>
        {isLoadingLatest ? (
          <div className="h-32 flex items-center justify-center border rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : latest ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="rounded-sm">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <CardTitle className="text-sm font-medium">Volatility</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ATR(14)</span>
                  <span>{formatNumber(latest.atr14, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Realized 24h</span>
                  <span>{formatPercent(latest.realizedVol24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parkinson 24h</span>
                  <span>{formatPercent(latest.parkinsonVol24h)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <CardTitle className="text-sm font-medium">Trend</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ret 1h</span>
                  <span className={(latest.returns1h || 0) >= 0 ? "text-bull" : "text-bear"}>{formatPercent(latest.returns1h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ret 24h</span>
                  <span className={(latest.returns24h || 0) >= 0 ? "text-bull" : "text-bear"}>{formatPercent(latest.returns24h)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mom(14)</span>
                  <span>{formatNumber(latest.momentum14)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">EMA Slope</span>
                  <span>{formatNumber(latest.emaSlope20)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <CardTitle className="text-sm font-medium">Market Structure</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">POC</span>
                  <span>{formatPrice(latest.poc)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAH</span>
                  <span>{formatPrice(latest.vah)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">VAL</span>
                  <span>{formatPrice(latest.val)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <CardTitle className="text-sm font-medium">Microstructure</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OB Imbal</span>
                  <span>{formatNumber(latest.orderbookImbalance, 3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">B/A Ratio</span>
                  <span>{formatNumber(latest.bidAskRatio, 3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CVD</span>
                  <span className={(latest.cvd || 0) >= 0 ? "text-bull" : "text-bear"}>{formatLargeNum(latest.cvd)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm">
              <CardHeader className="py-3 px-4 bg-muted/50 border-b">
                <CardTitle className="text-sm font-medium">Entropy</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 font-mono text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shannon</span>
                  <span>{formatEntropy(latest.shannonEntropy)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permut</span>
                  <span>{formatEntropy(latest.permutationEntropy)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center border rounded-md text-muted-foreground">
            No features available
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="rounded-sm">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium">Volatility Evolution (%)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[300px]">
            {isLoadingHistory ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="timeLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '0', color: 'hsl(var(--popover-foreground))', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="rVol24" name="Realized 24h" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="pVol24" name="Parkinson 24h" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium">Market Entropy</CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[300px]">
            {isLoadingHistory ? (
               <div className="h-full flex items-center justify-center">
                 <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
               </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="timeLabel" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '0', color: 'hsl(var(--popover-foreground))', fontSize: '12px', fontFamily: 'monospace' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
                  <Line type="monotone" dataKey="shannonEntropy" name="Shannon" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="permutationEntropy" name="Permutation" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold border-b pb-2">Feature History</h2>
        <Card className="rounded-sm border-0 shadow-none bg-transparent">
          <div className="border rounded-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-mono text-xs whitespace-nowrap">TIME</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">ATR(14)</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">R.VOL(24H)</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">RET(1H)</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">MOM(14)</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">OB IMBAL</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">CVD</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">SHANNON</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !historyData || historyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground font-mono text-sm">
                      No feature data found
                    </TableCell>
                  </TableRow>
                ) : (
                  historyData.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(new Date(row.timestamp), "MM/dd HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatNumber(row.atr14, 2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatPercent(row.realizedVol24h)}
                      </TableCell>
                      <TableCell className={`font-mono text-xs text-right ${(row.returns1h || 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {formatPercent(row.returns1h)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatNumber(row.momentum14, 2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatNumber(row.orderbookImbalance, 3)}
                      </TableCell>
                      <TableCell className={`font-mono text-xs text-right ${(row.cvd || 0) >= 0 ? 'text-bull' : 'text-bear'}`}>
                        {formatLargeNum(row.cvd)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-right">
                        {formatEntropy(row.shannonEntropy)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
