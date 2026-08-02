import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import Clientes from "./pages/Clientes";
import Calendario from "./pages/Calendario";
import Prazos from "./pages/Prazos";
import Financeiro from "./pages/Financeiro";
import Orcamentos from "./pages/Orcamentos";
import Calculadora from "./pages/Calculadora";
import Cobrancas from "./pages/Cobrancas";
import Integracoes from "./pages/Integracoes";
import Briefings from "./pages/Briefings";
import Contratos from "./pages/Contratos";
import Planos from "./pages/Planos";
import WhatsApp from "./pages/WhatsApp";
import Perfil from "./pages/Perfil";
import { OnboardingDialog } from "@/components/onboarding/OnboardingDialog";
import PortalCliente from "./pages/public/PortalCliente";
import BriefingPublico from "./pages/public/BriefingPublico";
import PropostaPublica from "./pages/public/PropostaPublica";
import AssistenteIA from "./pages/AssistenteIA";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/portal/:token" element={<PortalCliente />} />
            <Route path="/briefing/:token" element={<BriefingPublico />} />
            <Route path="/proposta/:slug" element={<PropostaPublica />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/demandas" element={<Demandas />} />
                      <Route path="/clientes" element={<Clientes />} />
                      <Route path="/calendario" element={<Calendario />} />
                      <Route path="/prazos" element={<Prazos />} />
                      <Route path="/financeiro" element={<Financeiro />} />
                      <Route path="/orcamentos" element={<Orcamentos />} />
                      <Route path="/cobrancas" element={<Cobrancas />} />
                      <Route path="/calculadora" element={<Calculadora />} />
                      <Route path="/integracoes" element={<Integracoes />} />
                      <Route path="/briefings" element={<Briefings />} />
                      <Route path="/contratos" element={<Contratos />} />
                      <Route path="/planos" element={<Planos />} />
                      <Route path="/whatsapp" element={<WhatsApp />} />
                      <Route path="/assistente" element={<AssistenteIA />} />
                      <Route path="/perfil" element={<Perfil />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <OnboardingDialog />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
