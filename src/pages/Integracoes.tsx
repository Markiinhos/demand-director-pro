import { useWhatsAppConnection } from "@/hooks/useWhatsAppConnection";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertCircle, MessageSquare, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MercadoPagoIntegrationCard } from "@/components/integrations/MercadoPagoIntegrationCard";
import { AsaasIntegrationCard } from "@/components/integrations/AsaasIntegrationCard";
import { MercadoLivreIntegrationCard } from "@/components/integrations/MercadoLivreIntegrationCard";
import { ChatGPTIntegration } from "@/components/integrations/ChatGPTIntegration";

export default function Integracoes() {
  const { isConnected, connection, isLoading: waLoading } = useWhatsAppConnection();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Integrações</h1>
        <p className="text-muted-foreground text-sm">Conecte serviços externos à sua conta.</p>
      </div>

      {/* Mercado Pago */}
      <MercadoPagoIntegrationCard />

      {/* WhatsApp Business */}
      <div
        className="bg-card border border-border/50 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer"
        onClick={() => navigate("/whatsapp")}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                WhatsApp Business
              </h2>
              <p className="text-sm text-muted-foreground">
                Conecte seu WhatsApp Business para enviar mensagens, cobranças, contratos e propostas automaticamente.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {waLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isConnected ? (
              <Badge variant="outline" className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                <CheckCircle2 className="h-3 w-3" />Conectado
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertCircle className="h-3 w-3" />Não conectado
              </Badge>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {isConnected && connection && (
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">{connection.phone_number || connection.phone_number_id}</span>
            {connection.display_name && <span>• {connection.display_name}</span>}
          </div>
        )}
      </div>

      {/* Asaas Integracao */}
      <AsaasIntegrationCard />

      {/* Mercado Livre Integracao */}
      <MercadoLivreIntegrationCard />

      {/* ChatGPT Actions */}
      <ChatGPTIntegration />
    </div>
  );
}