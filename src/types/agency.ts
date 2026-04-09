export type DemandStatus = 'pending' | 'in_progress' | 'review' | 'done';
export type Priority = 'high' | 'medium' | 'low';
export type ClientStatus = 'lead' | 'active' | 'recurring' | 'inactive';
export type ContractType = 'monthly' | 'project' | 'one_time';
export type ContractStatus = 'active' | 'ended';
export type TeamMemberType = 'employee' | 'freelancer';
export type PaymentStatus = 'pending' | 'paid' | 'overdue';
export type PipelineStage = 'lead' | 'contacted' | 'meeting' | 'proposal' | 'negotiation' | 'closed' | 'lost';
export type LeadSource = 'instagram' | 'whatsapp' | 'referral' | 'website' | 'other';
export type ContactChannel = 'whatsapp' | 'email';

export interface ContactInteraction {
  id: string;
  channel: ContactChannel;
  direction: 'inbound' | 'outbound';
  subject: string;
  summary: string;
  date: string;
  relatedTo?: 'client' | 'lead';
  relatedId?: string;
}

export interface Demand {
  id: string;
  title: string;
  type: string;
  clientId: string;
  projectId?: string;
  assigneeId: string;
  status: DemandStatus;
  priority: Priority;
  dueDate: string;
  notes: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  status: 'active' | 'completed' | 'paused';
  assigneeId: string;
  demandIds: string[];
  createdAt: string;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp?: string;
  status: ClientStatus;
  createdAt: string;
}

export interface Contract {
  id: string;
  clientId: string;
  type: ContractType;
  value: number;
  startDate: string;
  endDate: string;
  status: ContractStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  type: TeamMemberType;
  email: string;
  specialty?: string;
  ratePerDemand?: number;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  description: string;
  amount: number;
  category: string;
  clientId?: string;
  projectId?: string;
  demandId?: string;
  status: PaymentStatus;
  dueDate: string;
  paidDate?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  service: string;
  estimatedValue: number;
  source: LeadSource;
  stage: PipelineStage;
  assigneeId: string;
  notes: string;
  probability: number;
  phone?: string;
  email?: string;
  createdAt: string;
}
