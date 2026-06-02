import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Loader2, Brain, Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from "recharts";

// --- Types (until codegen runs) ---
interface RegimeState {
  id: number;
  symbol: string;
  timestamp: string;
  hmmBull?: number | null;
  hmmBear?: number | null;
  hmmSideways?: number | null;
  hmmPanic?: number | null;
  hmmState?: string | null;
  msRegime?: number | null;
  msProb0?: number | null;
  msProb1?: number | null;
  msIsHighVol?: boolean | null;
  modelsAgree?: boolean | null;
  regime?: string | null;
  regimeConfidence?: number | null;
}

// --- Fetch helpers (direct fetch until codegen) ---
function useLatestRegime(symbol = "BTC/USDT") {
  const [data, setData] = useMemo(() => {
    let d: RegimeState | null = null;
    let setD = (_: RegimeState | null) => {};
    return [d, setD];
  }, []);
  return { data, isLoading: false };
}

// Direct fetch — no codegen needed, plain React Query
import { useQuery } from "@tanstack/react-query";

function useRegimeLatest(symbol = "BTC/USDT") {
  return useQuery<RegimeState>({
    queryKey: ["regime", "latest", symbol],
    queryFn: async () => {
      const r = await fetch(`/api/regime/latest?symbol=${encodeURIComponent(symbol)}`);
      if (!r.ok) {
        if (r.status === 404) return null as any;
        throw new Error(await r.text());
      }
      return r.json();
    },
    refetchInterval: 30_000,
    retry: false,
  });
}

function useRegimeHistory(symbol = "BTC/USDT", limit = 120) {
  return useQuery<RegimeState[]>({
    queryKey: ["regime", "list", symbol, limit],
    queryFn: async () => {
      const r = await fetch(`/api/regime?symbol=${encodeURIComponent(symbol)}&limit=${limit}`);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    refetchInterval: 30_000,
    retry: false,
  });
}

// --- Regime color + icon map ---
const REGIME_CONFIG: Record<string, { color: string; bg: string; border: string; icon: JSX.Element; label: string }> = {
  Bull: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: <TrendingUp className="h-5 w-5 text-emerald-400" />,
    label: "BULL",
  },
  Bear: {
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: <TrendingDown className="h-5 w-5 text-red-400" />,
    label: "BEAR",
  },
  Sideways: {
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: <Minus className="h-5 w-5 text-yellow-400" />,
    label: "SIDEWAYS",
  },
  Panic: {
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: <AlertTriangle className="h-5 w-5 text-orange-400" />,
    label: "PANIC",
  },
};

const DEFAULT_REGIME = {
  color: "text-muted-foreground",
  bg: "bg-muted/20",
  border: "border-border",
  icon: <Activity className="h-5 w-5" />,
  label: "UNKNOWN",
};

const CHART_COLORS: Record<string, string> = {
  Bull: "#10b981",
  Bear: "#f87171",
  Sideways: "#facc15",
  Panic: "#fb923c",
};

function getRegimeConfig(regime?: string | null) {
  return REGIME_CONFIG[regime ?? ""] ?? DEFAULT_REGIME;
}

function pct(v?: number | null) {
  return v != null ? `${(v * 100).toFixed(1)}%` : "–";
}

export default function RegimePage() {
  const symbol = "BTC/USDT";
  const { data: latest, isLoading: isLoadingLatest } = useRegimeLatest(symbol);
  const { data: history, isLoading: isLoadingHistory } = useRegimeHistory(symbol, 120);

  const cfg = getRegimeConfig(latest?.regime);

  // Chart data — oldest first
  const chartData = useMemo(() => {
    if (!history) return [];
    return [...history].reverse().map((r) => ({
      time: format(new Date(r.timestamp), "HH:mm"),
      Bull: r.hmmBull ?? 0,
      Bear: r.hmmBear ?? 0,
      Sideways: r.hmmSideways ?? 0,
      Panic: r.hmmPanic ?? 0,
      confidence: r.regimeConfidence ?? 0,
      regime: r.regime,
    }));
  }, [history]);

  // Latest HMM probabilities as bar data
  const probData = latest
    ? [
        { name: "Bull", value: (latest.hmmBull ?? 0) * 100, fill: CHART_COLORS.Bull },
        { name: "Bear", value: (latest.hmmBear ?? 0) * 100, fill: CHART_COLORS.Bear },
        { name: "Sideways", value: (latest.hmmSideways ?? 0) * 100, fill: CHART_COLORS.Sideways },
        { name: "Panic", value: (latest.hmmPanic ?? 0) * 100, fill: CHART_COLORS.Panic },
      ]
    : [];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regime Detection</h1>
          <p className="text-muted-foreground font-mono text-sm mt-0.5">
            Phase 3 — HMM 4-State + Markov Switching Validator · {symbol}
          </p>
        </div>
      </div>

      {/* Main regime card + HMM bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Current Regime */}
        <Card className={`rounded-sm border ${cfg.border} ${cfg.bg} col-span-1`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono text-muted-foreground tracking-widest">CURRENT REGIME</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {isLoadingLatest ? (
              <div className="h-20 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !latest ? (
              <div className="space-y-2">
                <div className="text-lg font-bold text-muted-foreground">NO DATA</div>
                <p className="text-xs text-muted-foreground font-mono">
                  Run: python -m quant_bot.regime.trainer
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {cfg.icon}
                  <span className={`text-3xl font-black font-mono tracking-wider ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="space-y-1 font-mono text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className={`font-bold ${cfg.color}`}>{pct(latest.regimeConfidence)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">HMM State</span>
                    <span>{latest.hmmState ?? "–"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Models Agree</span>
                    <span className={latest.modelsAgree === true ? "text-emerald-400" : latest.modelsAgree === false ? "text-red-400" : "text-muted-foreground"}>
                      {latest.modelsAgree === true ? "✓ YES" : latest.modelsAgree === false ? "✗ NO" : "–"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">MS High Vol</span>
                    <span className={latest.msIsHighVol ? "text-orange-400" : "text-emerald-400"}>
                      {latest.msIsHighVol == null ? "–" : latest.msIsHighVol ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Updated</span>
                    <span>{format(new Date(latest.timestamp), "HH:mm:ss")}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* HMM State Probabilities Bar */}
        <Card className="rounded-sm col-span-2">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm font-medium">HMM State Probabilities (Current)</CardTitle>
          </CardHeader>
          <CardContent className="p-4 h-[200px]">
            {isLoadingLatest ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={probData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    fontFamily="monospace"
                    tickLine={false}
                    axisLine={false}
                    width={65}
                  />
                  <Tooltip
                    formatter={(v: number) => [`${v.toFixed(1)}%`, "Probability"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "2px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                    {probData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stacked Area — regime probs over time */}
      <Card className="rounded-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium">HMM State Probability Evolution (Last {chartData.length} updates)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 h-[260px]">
          {isLoadingHistory ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">
              No regime history yet — run python -m quant_bot.regime.trainer
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, name]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "2px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", fontFamily: "monospace" }} />
                <Area type="monotone" dataKey="Bull" stackId="1" stroke={CHART_COLORS.Bull} fill={CHART_COLORS.Bull} fillOpacity={0.6} isAnimationActive={false} />
                <Area type="monotone" dataKey="Sideways" stackId="1" stroke={CHART_COLORS.Sideways} fill={CHART_COLORS.Sideways} fillOpacity={0.6} isAnimationActive={false} />
                <Area type="monotone" dataKey="Bear" stackId="1" stroke={CHART_COLORS.Bear} fill={CHART_COLORS.Bear} fillOpacity={0.6} isAnimationActive={false} />
                <Area type="monotone" dataKey="Panic" stackId="1" stroke={CHART_COLORS.Panic} fill={CHART_COLORS.Panic} fillOpacity={0.6} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Confidence chart */}
      <Card className="rounded-sm">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium">Regime Confidence Score</CardTitle>
        </CardHeader>
        <CardContent className="p-4 h-[180px]">
          {isLoadingHistory ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={[0, 1]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip
                  formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, "Confidence"]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "2px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="confidence"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary))"
                  fillOpacity={0.15}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* History table */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold border-b pb-2 font-mono">REGIME HISTORY</h2>
        <Card className="rounded-sm border-0 shadow-none bg-transparent">
          <div className="border rounded-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-mono text-xs whitespace-nowrap">TIME</TableHead>
                  <TableHead className="font-mono text-xs whitespace-nowrap">REGIME</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">CONF</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">BULL</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">BEAR</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">SIDE</TableHead>
                  <TableHead className="font-mono text-xs text-right whitespace-nowrap">PANIC</TableHead>
                  <TableHead className="font-mono text-xs text-center whitespace-nowrap">AGREE</TableHead>
                  <TableHead className="font-mono text-xs text-center whitespace-nowrap">HIGH VOL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingHistory ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : !history || history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground font-mono text-sm">
                      No regime data · Run: python -m quant_bot.regime.trainer
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((row) => {
                    const rc = getRegimeConfig(row.regime);
                    return (
                      <TableRow key={row.id} className="hover:bg-muted/10 transition-colors">
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {format(new Date(row.timestamp), "MM/dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-sm border ${rc.color} ${rc.bg} ${rc.border}`}>
                            {rc.label}
                          </span>
                        </TableCell>
                        <TableCell className={`font-mono text-xs text-right font-bold ${rc.color}`}>
                          {pct(row.regimeConfidence)}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-right text-emerald-400">{pct(row.hmmBull)}</TableCell>
                        <TableCell className="font-mono text-xs text-right text-red-400">{pct(row.hmmBear)}</TableCell>
                        <TableCell className="font-mono text-xs text-right text-yellow-400">{pct(row.hmmSideways)}</TableCell>
                        <TableCell className="font-mono text-xs text-right text-orange-400">{pct(row.hmmPanic)}</TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          <span className={row.modelsAgree === true ? "text-emerald-400" : row.modelsAgree === false ? "text-red-400" : "text-muted-foreground"}>
                            {row.modelsAgree === true ? "✓" : row.modelsAgree === false ? "✗" : "–"}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-center">
                          <span className={row.msIsHighVol ? "text-orange-400" : "text-emerald-400"}>
                            {row.msIsHighVol == null ? "–" : row.msIsHighVol ? "YES" : "NO"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
