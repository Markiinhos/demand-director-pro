import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Demand, Client, TeamMember, Lead, Transaction, Project, Contract, ContactInteraction } from '@/types/agency';

interface AgencyContextType {
  demands: Demand[];
  setDemands: React.Dispatch<React.SetStateAction<Demand[]>>;
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  team: TeamMember[];
  setTeam: React.Dispatch<React.SetStateAction<TeamMember[]>>;
  leads: Lead[];
  setLeads: React.Dispatch<React.SetStateAction<Lead[]>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  contracts: Contract[];
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>;
  interactions: ContactInteraction[];
  setInteractions: React.Dispatch<React.SetStateAction<ContactInteraction[]>>;
}

const AgencyContext = createContext<AgencyContextType | undefined>(undefined);

const mockTeam: TeamMember[] = [
  { id: '1', name: 'Ana Silva', role: 'Designer Sênior', type: 'employee', email: 'ana@agencia.com' },
  { id: '2', name: 'Carlos Lima', role: 'Motion Designer', type: 'freelancer', email: 'carlos@email.com', specialty: 'Motion Graphics', ratePerDemand: 350 },
  { id: '3', name: 'Julia Costa', role: 'Social Media', type: 'employee', email: 'julia@agencia.com' },
  { id: '4', name: 'Pedro Santos', role: 'Copywriter', type: 'freelancer', email: 'pedro@email.com', specialty: 'Copy', ratePerDemand: 200 },
];

const mockClients: Client[] = [
  { id: '1', name: 'Maria Fernandes', company: 'TechFlow', email: 'maria@techflow.com', phone: '11999887766', whatsapp: '5511999887766', status: 'active', createdAt: '2024-01-15' },
  { id: '2', name: 'Roberto Alves', company: 'GreenLife', email: 'roberto@greenlife.com', phone: '11988776655', whatsapp: '5511988776655', status: 'recurring', createdAt: '2023-06-10' },
  { id: '3', name: 'Fernanda Souza', company: 'Urban Fit', email: 'fernanda@urbanfit.com', phone: '11977665544', whatsapp: '5511977665544', status: 'active', createdAt: '2024-03-01' },
];

const mockDemands: Demand[] = [
  { id: '1', title: 'Feed Instagram - Março', type: 'Social Media', clientId: '1', assigneeId: '3', status: 'in_progress', priority: 'high', dueDate: '2026-04-12', notes: '12 posts + stories', createdAt: '2026-04-01' },
  { id: '2', title: 'Logo Redesign', type: 'Logotipo', clientId: '2', assigneeId: '1', status: 'review', priority: 'medium', dueDate: '2026-04-15', notes: 'Versão minimalista', createdAt: '2026-03-20' },
  { id: '3', title: 'Vídeo Institucional', type: 'Motion', clientId: '3', assigneeId: '2', status: 'pending', priority: 'high', dueDate: '2026-04-20', notes: '30 segundos', createdAt: '2026-04-05' },
  { id: '4', title: 'Banner Promoção', type: 'Banner', clientId: '1', assigneeId: '1', status: 'done', priority: 'low', dueDate: '2026-04-08', notes: '', createdAt: '2026-04-02' },
  { id: '5', title: 'Copy Landing Page', type: 'Copy', clientId: '3', assigneeId: '4', status: 'pending', priority: 'medium', dueDate: '2026-04-18', notes: 'Página de vendas produto novo', createdAt: '2026-04-06' },
  { id: '6', title: 'Identidade Visual', type: 'Branding', clientId: '2', assigneeId: '1', status: 'in_progress', priority: 'high', dueDate: '2026-04-25', notes: 'Manual completo', createdAt: '2026-03-15' },
];

const mockLeads: Lead[] = [
  { id: '1', name: 'João Mendes', company: 'StartUp X', service: 'Branding completo', estimatedValue: 8000, source: 'instagram', stage: 'proposal', assigneeId: '1', notes: 'Muito interessado', probability: 70, phone: '11966554433', email: 'joao@startupx.com', createdAt: '2026-04-01' },
  { id: '2', name: 'Camila Torres', company: 'Café Aroma', service: 'Social Media', estimatedValue: 3000, source: 'referral', stage: 'meeting', assigneeId: '3', notes: 'Indicação do Roberto', probability: 60, phone: '11955443322', email: 'camila@cafearoma.com', createdAt: '2026-04-03' },
  { id: '3', name: 'Lucas Oliveira', company: 'FitPro', service: 'Motion + Social', estimatedValue: 5500, source: 'whatsapp', stage: 'contacted', assigneeId: '1', notes: '', probability: 30, phone: '11944332211', createdAt: '2026-04-06' },
  { id: '4', name: 'Renata Dias', company: 'BeautyLab', service: 'Landing page', estimatedValue: 4000, source: 'website', stage: 'lead', assigneeId: '3', notes: 'Formulário do site', probability: 20, email: 'renata@beautylab.com', createdAt: '2026-04-07' },
];

const mockTransactions: Transaction[] = [
  { id: '1', type: 'income', description: 'Mensalidade TechFlow', amount: 5000, category: 'Mensalidade', clientId: '1', status: 'paid', dueDate: '2026-04-05', paidDate: '2026-04-04', createdAt: '2026-04-01' },
  { id: '2', type: 'income', description: 'Projeto Branding GreenLife', amount: 12000, category: 'Projeto', clientId: '2', status: 'pending', dueDate: '2026-04-20', createdAt: '2026-03-20' },
  { id: '3', type: 'income', description: 'Mensalidade Urban Fit', amount: 3500, category: 'Mensalidade', clientId: '3', status: 'paid', dueDate: '2026-04-10', paidDate: '2026-04-09', createdAt: '2026-04-01' },
  { id: '4', type: 'expense', description: 'Carlos Lima - Motion', amount: 1400, category: 'Terceirizado', status: 'pending', dueDate: '2026-04-15', createdAt: '2026-04-01' },
  { id: '5', type: 'expense', description: 'Ferramentas (Adobe + Figma)', amount: 890, category: 'Ferramentas', status: 'paid', dueDate: '2026-04-01', paidDate: '2026-04-01', createdAt: '2026-04-01' },
  { id: '6', type: 'expense', description: 'Aluguel Escritório', amount: 2500, category: 'Fixo', status: 'paid', dueDate: '2026-04-05', paidDate: '2026-04-05', createdAt: '2026-04-01' },
  { id: '7', type: 'income', description: 'Mensalidade TechFlow - Maio', amount: 5000, category: 'Mensalidade', clientId: '1', status: 'pending', dueDate: '2026-05-05', createdAt: '2026-04-01' },
];

const mockInteractions: ContactInteraction[] = [
  { id: '1', channel: 'whatsapp', direction: 'outbound', subject: 'Briefing do projeto', summary: 'Enviado briefing para aprovação do logo redesign', date: '2026-04-02', relatedTo: 'client', relatedId: '2' },
  { id: '2', channel: 'email', direction: 'inbound', subject: 'Aprovação de artes', summary: 'Cliente aprovou 8 dos 12 posts do feed', date: '2026-04-06', relatedTo: 'client', relatedId: '1' },
  { id: '3', channel: 'whatsapp', direction: 'outbound', subject: 'Proposta comercial', summary: 'Enviada proposta de branding completo', date: '2026-04-05', relatedTo: 'lead', relatedId: '1' },
  { id: '4', channel: 'email', direction: 'outbound', subject: 'Follow-up reunião', summary: 'Enviado resumo da reunião e próximos passos', date: '2026-04-04', relatedTo: 'lead', relatedId: '2' },
  { id: '5', channel: 'whatsapp', direction: 'inbound', subject: 'Dúvida sobre prazo', summary: 'Cliente perguntou sobre prazo de entrega do vídeo', date: '2026-04-07', relatedTo: 'client', relatedId: '3' },
];

export function AgencyProvider({ children }: { children: ReactNode }) {
  const [demands, setDemands] = useState<Demand[]>(mockDemands);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [team, setTeam] = useState<TeamMember[]>(mockTeam);
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [interactions, setInteractions] = useState<ContactInteraction[]>(mockInteractions);

  return (
    <AgencyContext.Provider value={{
      demands, setDemands,
      clients, setClients,
      team, setTeam,
      leads, setLeads,
      transactions, setTransactions,
      projects, setProjects,
      contracts, setContracts,
      interactions, setInteractions,
    }}>
      {children}
    </AgencyContext.Provider>
  );
}

export function useAgency() {
  const ctx = useContext(AgencyContext);
  if (!ctx) throw new Error('useAgency must be used within AgencyProvider');
  return ctx;
}
