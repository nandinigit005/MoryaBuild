/**
 * Automated test script for Morya Enterprises Project CRUD Service & Dashboard Metrics
 * Contractor: Aniket Desai
 * Demo Data: 5 Construction Projects (₹20L - ₹30L)
 */
import { projectStorage, formatINR, formatFullINR } from '../services/storage';

console.log('=== RUNNING MORYA ENTERPRISES (CONTRACTOR: ANIKET DESAI) TESTS ===');

// 1. Initial Projects & Demo Data Check
const projects = projectStorage.getAll();
console.log(`[PASS] Loaded ${projects.length} construction projects`);
if (projects.length !== 5) {
  throw new Error(`Expected exactly 5 demo construction projects, found ${projects.length}`);
}

// Verify contract range between ₹20,00,000 and ₹30,00,000
projects.forEach((p) => {
  if (p.contractAmount < 2000000 || p.contractAmount > 3000000) {
    throw new Error(`Project ${p.name} contract ${p.contractAmount} is out of ₹20L-₹30L range`);
  }
  if (!p.contractorName.includes('Aniket Desai')) {
    throw new Error(`Project ${p.name} contractor name must be Aniket Desai`);
  }
});
console.log('[PASS] All demo projects have contract values strictly between ₹20,00,000 and ₹30,00,000 and Contractor Aniket Desai.');

// 2. Metrics Verification
const metrics = projectStorage.getMetrics();
console.log(`[METRICS] Total Contract: ${formatFullINR(metrics.totalContractValue)} (${formatINR(metrics.totalContractValue)})`);
console.log(`[METRICS] Approved Budget: ${formatFullINR(metrics.totalApprovedBudget)}`);
console.log(`[METRICS] Actual Expenses: ${formatFullINR(metrics.totalActualExpenses)} (${metrics.budgetUtilizationPct}% burn)`);
console.log(`[METRICS] Payments Received: ${formatFullINR(metrics.totalPaymentsReceived)}`);
console.log(`[METRICS] Outstanding Due: ${formatFullINR(metrics.totalOutstandingPayments)}`);
console.log(`[METRICS] Active Projects: ${metrics.activeProjects}, Overall Progress: ${metrics.overallCompletionProgress}%`);

if (metrics.totalContractValue !== 12655000) {
  throw new Error(`Expected Total Contract ₹1,26,55,000, got ${metrics.totalContractValue}`);
}
if (metrics.totalApprovedBudget !== 10740000) {
  throw new Error(`Expected Total Budget ₹1,07,40,000, got ${metrics.totalApprovedBudget}`);
}
if (metrics.totalActualExpenses !== 7560000) {
  throw new Error(`Expected Total Actual Expenses ₹75,60,000, got ${metrics.totalActualExpenses}`);
}
if (metrics.totalPaymentsReceived !== 8680000) {
  throw new Error(`Expected Payments Received ₹86,80,000, got ${metrics.totalPaymentsReceived}`);
}
if (metrics.totalOutstandingPayments !== 3975000) {
  throw new Error(`Expected Outstanding Payments ₹39,75,000, got ${metrics.totalOutstandingPayments}`);
}
console.log('[PASS] All financial business metrics calculated accurately from project records!');

// 3. Project Creation
const newProject = projectStorage.create({
  name: 'Modern duplex villa construction',
  description: 'Duplex villa with load-bearing RCC frame and solar roof integration.',
  constructionType: 'RESIDENTIAL',
  location: 'Pashan, Pune',
  clientName: 'Sanjay Deshmukh',
  clientEmail: 'sanjay@example.com',
  contractAmount: 2600000, // ₹26,00,000
  approvedBudget: 2200000, // ₹22,00,000
  actualExpenses: 250000,
  amountPaid: 600000,     // ₹6,00,000
  plannedStartDate: '2026-04-01',
  expectedCompletionDate: '2026-12-31',
  status: 'PLANNING',
  progress: 10,
  projectManager: 'Er. Sachin More',
  contractorName: 'Aniket Desai',
});

console.log(`[PASS] Created project: ${newProject.projectCode} (${newProject.name}), Outstanding Due = ${formatFullINR(newProject.outstandingAmount)}`);
if (newProject.outstandingAmount !== 2000000) {
  throw new Error(`Expected outstanding amount 20,00,000, got ${newProject.outstandingAmount}`);
}

// 4. Update
const updated = projectStorage.update(newProject.id, {
  progress: 30,
  amountPaid: 1000000,
  actualExpenses: 650000,
});
if (updated.outstandingAmount !== 1600000 || updated.progress !== 30) {
  throw new Error(`Failed to update project progress and payment balance`);
}
console.log(`[PASS] Updated project: Progress = ${updated.progress}%, New Outstanding = ${formatFullINR(updated.outstandingAmount)}`);

// 5. Delete & Clean up
projectStorage.delete(newProject.id);
console.log('[PASS] Deleted project test successfully cleaned up.');

console.log('=== ALL MORYA ENTERPRISES (ANIKET DESAI) DASHBOARD & PROJECT TESTS PASSED! ===');
