import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import OhlcvPage from "@/pages/ohlcv";
import FundingPage from "@/pages/funding";
import OpenInterestPage from "@/pages/open-interest";
import LiquidationsPage from "@/pages/liquidations";
import OrderbookPage from "@/pages/orderbook";
import CollectorPage from "@/pages/collector";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/ohlcv" component={OhlcvPage} />
        <Route path="/funding" component={FundingPage} />
        <Route path="/open-interest" component={OpenInterestPage} />
        <Route path="/liquidations" component={LiquidationsPage} />
        <Route path="/orderbook" component={OrderbookPage} />
        <Route path="/collector" component={CollectorPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
