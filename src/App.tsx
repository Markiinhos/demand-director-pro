import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AgencyProvider } from "@/contexts/AgencyContext";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import Prazos from "./pages/Prazos";
import Clientes from "./pages/Clientes";
import Equipe from "./pages/Equipe";
import Pipeline from "./pages/Pipeline";
import Financeiro from "./pages/Financeiro";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AgencyProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/demandas" element={<Demandas />} />
              <Route path="/prazos" element={<Prazos />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/equipe" element={<Equipe />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AgencyProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
