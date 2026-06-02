import { Link, useLocation } from "wouter";
import { 
  Activity, 
  BarChart2, 
  Brain,
  CandlestickChart, 
  Database, 
  Layers, 
  PieChart, 
  TrendingDown,
  Zap
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: Activity },
    { label: "OHLCV Data", href: "/ohlcv", icon: CandlestickChart },
    { label: "Funding Rates", href: "/funding", icon: PieChart },
    { label: "Open Interest", href: "/open-interest", icon: BarChart2 },
    { label: "Liquidations", href: "/liquidations", icon: TrendingDown },
    { label: "Orderbook", href: "/orderbook", icon: Layers },
    { label: "Features", href: "/features", icon: Zap },
    { label: "Regime (P3)", href: "/regime", icon: Brain },
    { label: "Collectors", href: "/collector", icon: Database },
  ];

  return (
    <div className="w-64 border-r bg-card flex flex-col h-full font-mono text-sm">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold tracking-tight">QUANT_BOT<span className="text-primary">.OS</span></h1>
        <div className="text-xs text-muted-foreground mt-1">v1.1.0 [LIVE] · Phase 3</div>
      </div>
      
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${isActive ? 'bg-secondary text-primary font-bold' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>SYS.STATUS:</span>
        <span className="text-bull flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-bull animate-pulse"></span> ONLINE</span>
      </div>
    </div>
  );
}
