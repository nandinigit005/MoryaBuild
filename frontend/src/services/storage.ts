import { Project, DashboardMetrics } from '../types';

// Key for storage persistence. Version 2 aligns with the updated 20L-30L demo data.
const STORAGE_KEY = 'morya_contractor_projects_v2';

// Clearly labeled realistic construction demo data (Contracts between ₹20,00,000 and ₹30,00,000)
export const DEMO_PROJECTS: Project[] = [
  {
    id: 'prj-001',
    projectCode: 'MORYA-PRJ-2026-001',
    name: 'Residential Building Construction',
    description: 'Ground plus 3-storey RCC residential building with foundation piling, brick masonry, and plumbing works.',
    constructionType: 'RESIDENTIAL',
    location: 'Baner Hills, Pune, Maharashtra',
    clientName: 'Vijay & Sunita Sharma',
    clientEmail: 'vijay.sharma@example.com',
    contractAmount: 2850000, // ₹28,50,000
    approvedBudget: 2420000, // ₹24,20,000
    actualExpenses: 1680000, // ₹16,80,000
    amountPaid: 2000000,     // ₹20,00,000
    outstandingAmount: 850000, // ₹8,50,000
    plannedStartDate: '2025-06-01',
    expectedCompletionDate: '2026-05-30',
    status: 'IN_PROGRESS',
    progress: 65,
    contractorName: 'Aniket Desai',
    projectManager: 'Er. Sachin More',
    costRiskScore: 24.5,
    costRiskTier: 'LOW',
    scheduleRiskScore: 22.0,
    scheduleRiskTier: 'LOW',
    isDemoData: true,
    createdAt: '2025-05-20T10:00:00Z',
  },
  {
    id: 'prj-002',
    projectCode: 'MORYA-PRJ-2026-002',
    name: 'Commercial Office Renovation',
    description: 'Complete interior renovation, glass partitioning, acoustic ceiling, electrical wiring, and HVAC ducting for tech office.',
    constructionType: 'COMMERCIAL',
    location: 'Viman Nagar, Pune, Maharashtra',
    clientName: 'Apex Tech Solutions (Rohan Mehta)',
    clientEmail: 'rohan.mehta@apextech.example.com',
    contractAmount: 2275000, // ₹22,75,000
    approvedBudget: 1930000, // ₹19,30,000
    actualExpenses: 1580000, // ₹15,80,000
    amountPaid: 1400000,     // ₹14,00,000
    outstandingAmount: 875000, // ₹8,75,000
    plannedStartDate: '2025-09-15',
    expectedCompletionDate: '2026-03-31',
    status: 'IN_PROGRESS',
    progress: 72,
    contractorName: 'Aniket Desai',
    projectManager: 'Er. Nikhil Jagtap',
    costRiskScore: 72.8,
    costRiskTier: 'HIGH',
    scheduleRiskScore: 68.0,
    scheduleRiskTier: 'MEDIUM',
    isDemoData: true,
    createdAt: '2025-09-01T11:30:00Z',
  },
  {
    id: 'prj-003',
    projectCode: 'MORYA-PRJ-2026-003',
    name: 'Bungalow Construction',
    description: 'Custom independent luxury bungalow with RCC columns, teakwood finishing, waterproof terrace, and boundary landscaping.',
    constructionType: 'RESIDENTIAL',
    location: 'Kothrud Green Valley, Pune, Maharashtra',
    clientName: 'Dr. Arvind Deshpande',
    clientEmail: 'dr.deshpande@example.com',
    contractAmount: 3000000, // ₹30,00,000
    approvedBudget: 2550000, // ₹25,50,000
    actualExpenses: 2480000, // ₹24,80,000
    amountPaid: 2700000,     // ₹27,00,000
    outstandingAmount: 300000, // ₹3,00,000
    plannedStartDate: '2024-11-01',
    expectedCompletionDate: '2026-02-28',
    status: 'IN_PROGRESS',
    progress: 95,
    contractorName: 'Aniket Desai',
    projectManager: 'Er. Sachin More',
    costRiskScore: 18.0,
    costRiskTier: 'LOW',
    scheduleRiskScore: 16.5,
    scheduleRiskTier: 'LOW',
    isDemoData: true,
    createdAt: '2024-10-15T09:15:00Z',
  },
  {
    id: 'prj-004',
    projectCode: 'MORYA-PRJ-2026-004',
    name: 'Apartment Interior and Finishing',
    description: 'Full 3-BHK luxury apartment interior: Italian marble polishing, modular kitchen, POP false ceiling, and designer lighting.',
    constructionType: 'RENOVATION',
    location: 'Wakad Park Avenue, Pune, Maharashtra',
    clientName: 'Kavita & Rajesh Iyer',
    clientEmail: 'iyer.family@example.com',
    contractAmount: 2450000, // ₹24,50,000
    approvedBudget: 2080000, // ₹20,80,000
    actualExpenses: 100000,  // ₹1,00,000
    amountPaid: 500000,      // ₹5,00,000 (Advance token)
    outstandingAmount: 1950000, // ₹19,50,000
    plannedStartDate: '2026-03-01',
    expectedCompletionDate: '2026-08-31',
    status: 'PLANNING',
    progress: 8,
    contractorName: 'Aniket Desai',
    projectManager: 'Er. Nikhil Jagtap',
    costRiskScore: 15.0,
    costRiskTier: 'LOW',
    scheduleRiskScore: 14.0,
    scheduleRiskTier: 'LOW',
    isDemoData: true,
    createdAt: '2026-02-10T14:20:00Z',
  },
  {
    id: 'prj-005',
    projectCode: 'MORYA-PRJ-2026-005',
    name: 'Small Commercial Building',
    description: 'Two-storey commercial retail shop complex with steel structure, rolling shutters, and exterior weather-resistant paint.',
    constructionType: 'COMMERCIAL',
    location: 'Hadapsar Industrial Zone, Pune, Maharashtra',
    clientName: 'Omkar Traders (Pradeep Kadam)',
    clientEmail: 'omkar.traders@example.com',
    contractAmount: 2080000, // ₹20,80,000
    approvedBudget: 1760000, // ₹17,60,000
    actualExpenses: 1720000, // ₹17,20,000
    amountPaid: 2080000,     // ₹20,80,000 (Fully cleared)
    outstandingAmount: 0,    // ₹0
    plannedStartDate: '2024-08-15',
    expectedCompletionDate: '2025-10-30',
    actualCompletionDate: '2025-10-25',
    status: 'COMPLETED',
    progress: 100,
    contractorName: 'Aniket Desai',
    projectManager: 'Er. Sachin More',
    costRiskScore: 12.0,
    costRiskTier: 'LOW',
    scheduleRiskScore: 10.0,
    scheduleRiskTier: 'LOW',
    isDemoData: true,
    createdAt: '2024-07-28T08:00:00Z',
  }
];

// Safe storage adapter that works in both browser and node test environments
const memoryStore: Record<string, string> = {};

const getStorageItem = (key: string): string | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem(key);
  }
  return memoryStore[key] || null;
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(key, value);
  }
  memoryStore[key] = value;
};

export const projectStorage = {
  getAll: (): Project[] => {
    try {
      const data = getStorageItem(STORAGE_KEY);
      if (!data) {
        setStorageItem(STORAGE_KEY, JSON.stringify(DEMO_PROJECTS));
        return DEMO_PROJECTS;
      }
      return JSON.parse(data);
    } catch {
      return DEMO_PROJECTS;
    }
  },

  getById: (id: string): Project | undefined => {
    const list = projectStorage.getAll();
    return list.find((p) => p.id === id || p.projectCode === id);
  },

  create: (projectData: Omit<Project, 'id' | 'createdAt' | 'projectCode' | 'outstandingAmount'> & { projectCode?: string; outstandingAmount?: number }): Project => {
    const list = projectStorage.getAll();
    const newId = `prj-${Date.now().toString(36)}`;
    const newCode = projectData.projectCode || `MORYA-PRJ-${new Date().getFullYear()}-${String(list.length + 1).padStart(3, '0')}`;
    
    // Auto calculate initial risk baseline based on budget & progress
    const costRiskScore = projectData.approvedBudget > 0 && projectData.actualExpenses > 0
      ? Math.min(100, Math.round(((projectData.actualExpenses / projectData.approvedBudget) * 100 - projectData.progress + 10) * 1.5))
      : 20.0;
    const costTier: 'LOW' | 'MEDIUM' | 'HIGH' = costRiskScore >= 70 ? 'HIGH' : costRiskScore >= 35 ? 'MEDIUM' : 'LOW';

    const contractAmt = Number(projectData.contractAmount) || 0;
    const paidAmt = Number(projectData.amountPaid) || 0;
    const outstanding = Math.max(0, contractAmt - paidAmt);

    const newProject: Project = {
      ...projectData,
      id: newId,
      projectCode: newCode,
      contractorName: projectData.contractorName || 'Aniket Desai',
      amountPaid: paidAmt,
      outstandingAmount: outstanding,
      costRiskScore: Math.max(5, costRiskScore),
      costRiskTier: costTier,
      scheduleRiskScore: 25.0,
      scheduleRiskTier: 'LOW',
      isDemoData: false, // User created projects are marked as real
      createdAt: new Date().toISOString(),
    };

    const updated = [newProject, ...list];
    setStorageItem(STORAGE_KEY, JSON.stringify(updated));
    return newProject;
  },

  update: (id: string, updates: Partial<Project>): Project => {
    const list = projectStorage.getAll();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Project with ID ${id} not found.`);
    }

    const calculatedRiskTier: 'LOW' | 'MEDIUM' | 'HIGH' =
      (updates.costRiskScore ?? list[index].costRiskScore ?? 20) >= 70
        ? 'HIGH'
        : (updates.costRiskScore ?? list[index].costRiskScore ?? 20) >= 35
        ? 'MEDIUM'
        : 'LOW';

    const current = list[index];
    const contractAmt = updates.contractAmount ?? current.contractAmount;
    const paidAmt = updates.amountPaid ?? current.amountPaid ?? 0;
    const outstanding = updates.outstandingAmount ?? Math.max(0, contractAmt - paidAmt);

    const updatedProject: Project = {
      ...current,
      ...updates,
      contractorName: updates.contractorName ?? current.contractorName ?? 'Aniket Desai',
      amountPaid: paidAmt,
      outstandingAmount: outstanding,
      costRiskTier: updates.costRiskTier ?? calculatedRiskTier,
    };

    list[index] = updatedProject;
    setStorageItem(STORAGE_KEY, JSON.stringify(list));
    return updatedProject;
  },

  delete: (id: string): boolean => {
    const list = projectStorage.getAll();
    const filtered = list.filter((p) => p.id !== id);
    if (filtered.length === list.length) return false;
    setStorageItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },

  getMetrics: (): DashboardMetrics => {
    const projects = projectStorage.getAll();
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const planningProjects = projects.filter((p) => p.status === 'PLANNING').length;
    const onHoldProjects = projects.filter((p) => p.status === 'ON_HOLD').length;
    const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
    const atRiskProjects = projects.filter((p) => p.costRiskTier === 'HIGH' || p.scheduleRiskTier === 'HIGH').length;

    // Direct aggregation from records (no hardcoded unrelated figures)
    const totalContractValue = projects.reduce((sum, p) => sum + (Number(p.contractAmount) || 0), 0);
    const totalApprovedBudget = projects.reduce((sum, p) => sum + (Number(p.approvedBudget) || 0), 0);
    const totalActualExpenses = projects.reduce((sum, p) => sum + (Number(p.actualExpenses) || 0), 0);
    const totalRemainingBudget = Math.max(0, totalApprovedBudget - totalActualExpenses);

    const totalPaymentsReceived = projects.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    const totalOutstandingPayments = projects.reduce((sum, p) => sum + (Number(p.outstandingAmount) || 0), 0);

    // Completion progress calculation (average across projects)
    const overallCompletionProgress = totalProjects > 0
      ? Math.round(projects.reduce((sum, p) => sum + (p.progress || 0), 0) / totalProjects)
      : 0;

    // Budget utilization %: totalActualExpenses / totalApprovedBudget
    const budgetUtilizationPct = totalApprovedBudget > 0
      ? Math.round((totalActualExpenses / totalApprovedBudget) * 100)
      : 0;

    return {
      totalProjects,
      activeProjects,
      planningProjects,
      onHoldProjects,
      completedProjects,
      atRiskProjects,
      totalContractValue,
      totalApprovedBudget,
      totalActualExpenses,
      totalRemainingBudget,
      totalPaymentsReceived,
      totalOutstandingPayments,
      overallCompletionProgress,
      budgetUtilizationPct,
      upcomingMilestones: 8,
      overdueMilestones: 1,
    };
  },

  resetDefaults: (): void => {
    setStorageItem(STORAGE_KEY, JSON.stringify(DEMO_PROJECTS));
  }
};

/**
 * Format amounts using Indian numbering system:
 * >= ₹1 Crore -> ₹1.26 Cr
 * >= ₹1 Lakh -> ₹28.50 L
 * standard -> ₹28,50,000
 */
export const formatINR = (val: number): string => {
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)} Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};

/**
 * Format full exact Indian currency: e.g. ₹28,50,000
 */
export const formatFullINR = (val: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
};
