export type ConstructionType = 
  | 'RESIDENTIAL'
  | 'COMMERCIAL'
  | 'INFRASTRUCTURE'
  | 'INDUSTRIAL'
  | 'RENOVATION';

export type ProjectStatus = 
  | 'PLANNING'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

export type UserRole = 'ADMIN' | 'PROJECT_MANAGER' | 'CLIENT';

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  description: string;
  constructionType: ConstructionType;
  location: string;
  clientName: string;
  clientEmail: string;
  clientId?: string;
  contractAmount: number; // in INR ₹
  approvedBudget: number; // in INR ₹
  actualExpenses: number; // in INR ₹
  amountPaid: number; // Payments received from client in INR ₹
  outstandingAmount: number; // Pending payments from client in INR ₹
  plannedStartDate: string;
  expectedCompletionDate: string;
  actualCompletionDate?: string;
  status: ProjectStatus;
  progress: number; // 0 - 100
  projectManager: string;
  contractorName: string; // e.g. "Aniket Desai"
  costRiskScore?: number;
  costRiskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  scheduleRiskScore?: number;
  scheduleRiskTier?: 'LOW' | 'MEDIUM' | 'HIGH';
  isDemoData?: boolean;
  createdAt: string;
}

export interface ProjectFormData {
  projectCode?: string;
  clientId?: string;
  name: string;
  description: string;
  constructionType: ConstructionType;
  location: string;
  clientName: string;
  clientEmail: string;
  contractAmount: number;
  approvedBudget: number;
  amountPaid?: number;
  plannedStartDate: string;
  expectedCompletionDate: string;
  status: ProjectStatus;
  progress: number;
  projectManager: string;
  contractorName?: string;
}

export interface DashboardMetrics {
  totalProjects: number;
  activeProjects: number;
  planningProjects: number;
  onHoldProjects: number;
  completedProjects: number;
  atRiskProjects: number;
  totalContractValue: number;
  totalApprovedBudget: number;
  totalActualExpenses: number;
  totalRemainingBudget: number;
  totalPaymentsReceived: number;
  totalOutstandingPayments: number;
  overallCompletionProgress: number; // weighted or average progress %
  budgetUtilizationPct: number; // actualExpenses / totalApprovedBudget %
  upcomingMilestones: number;
  overdueMilestones: number;
}
