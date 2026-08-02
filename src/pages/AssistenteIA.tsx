import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AIChat from "@/components/assistant/AIChat";
import AIDailyBrief from "@/components/assistant/AIDailyBrief";
import AIApprovalQueue from "@/components/assistant/AIApprovalQueue";
import AIActivityLog from "@/components/assistant/AIActivityLog";
import AIKnowledgeManager from "@/components/assistant/AIKnowledgeManager";
import AISettingsDialog from "@/components/assistant/AISettingsDialog";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";

const AssistenteIA = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Assistente IA
          </h1>
          <p className="page-subtitle">Seu agente gestor interno para controle e rotinas operacionais</p>
        </div>
        <Button variant="outline" onClick={() => setIsSettingsOpen(true)} className="gap-2">
          <Settings className="w-4 h-4" />
          Configurações
        </Button>
      </div>

      <Tabs defaultValue="chat" className="space-y-6">
        <TabsList className="bg-muted/50 border-border/50">
          <TabsTrigger value="chat">Chat / Interação</TabsTrigger>
          <TabsTrigger value="daily">Resumo Diário</TabsTrigger>
          <TabsTrigger value="approvals">Aprovações</TabsTrigger>
          <TabsTrigger value="knowledge">Base de Conhecimento</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="m-0">
          <div className="h-[calc(100vh-250px)] rounded-xl border bg-card shadow-sm overflow-hidden">
            <AIChat />
          </div>
        </TabsContent>

        <TabsContent value="daily" className="m-0">
          <AIDailyBrief />
        </TabsContent>

        <TabsContent value="approvals" className="m-0">
          <AIApprovalQueue />
        </TabsContent>

        <TabsContent value="knowledge" className="m-0">
          <AIKnowledgeManager />
        </TabsContent>

        <TabsContent value="history" className="m-0">
          <AIActivityLog />
        </TabsContent>
      </Tabs>

      <AISettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </div>
  );
};

export default AssistenteIA;
