import { useGetCollectorStatus, getGetCollectorStatusQueryKey } from "@workspace/api-client-react";
import { formatDate, formatNumber } from "@/lib/format";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export default function CollectorPage() {
  const { data: status, isLoading } = useGetCollectorStatus(
    { query: { queryKey: getGetCollectorStatusQueryKey(), refetchInterval: 15000 } }
  );

  return (
    <div className="flex-1 p-6 flex flex-col gap-6 overflow-auto">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Collector Health</h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">Data ingestion pipeline status</p>
        </div>
        <div className="text-sm font-mono text-muted-foreground">
          Global Check: {isLoading ? "..." : formatDate(status?.updatedAt)}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-muted-foreground font-mono">Scanning collectors...</div>
        ) : status?.collectors?.map(c => {
          const isOk = c.status === 'OK';
          return (
            <div key={c.name} className={`border bg-card rounded-sm p-5 relative overflow-hidden ${isOk ? 'border-border' : 'border-destructive'}`}>
              {!isOk && <div className="absolute top-0 left-0 w-full h-1 bg-destructive"></div>}
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg font-mono tracking-tight">{c.name}</h3>
                {isOk ? <CheckCircle2 className="w-5 h-5 text-bull" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
              </div>
              
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1 font-mono uppercase">Status</div>
                  <div className={`font-mono font-bold text-sm ${isOk ? 'text-bull' : 'text-destructive'}`}>
                    {c.status}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-mono uppercase">Total Records</div>
                    <div className="font-mono text-sm">{formatNumber(c.recordCount, 0)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1 font-mono uppercase">Last Run</div>
                    <div className="font-mono text-sm flex items-center gap-1">
                      <Clock className="w-3 h-3 opacity-50" />
                      {c.lastRun ? formatTimeOnly(c.lastRun) : '-'}
                    </div>
                  </div>
                </div>

                {c.errorMessage && (
                  <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-sm">
                    <div className="text-xs text-destructive font-mono uppercase mb-1">Error Trace</div>
                    <div className="text-xs text-destructive/80 font-mono break-all">{c.errorMessage}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTimeOnly(ts: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}
