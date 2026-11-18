import { PrismaClient, Role, ConstructionType, ProjectStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SEEDING MORYA ENTERPRISES (CONTRACTOR: ANIKET DESAI) DATABASE ---');

  // 1. Create or update Principal Contractor User
  const passwordHash = await bcrypt.hash('MoryaAdmin@2026', 10);
  const contractor = await prisma.user.upsert({
    where: { email: 'aniket.desai@moryaenterprises.com' },
    update: {
      name: 'Aniket Desai',
      role: Role.ADMIN,
      phone: '+91 98220 12345',
    },
    create: {
      email: 'aniket.desai@moryaenterprises.com',
      passwordHash,
      name: 'Aniket Desai',
      role: Role.ADMIN,
      phone: '+91 98220 12345',
    },
  });
  console.log(`[PASS] Contractor User initialized: ${contractor.name} (${contractor.email})`);

  // Project Managers
  const pm1 = await prisma.user.upsert({
    where: { email: 'sachin.more@moryaenterprises.com' },
    update: { name: 'Er. Sachin More', role: Role.PROJECT_MANAGER },
    create: {
      email: 'sachin.more@moryaenterprises.com',
      passwordHash,
      name: 'Er. Sachin More',
      role: Role.PROJECT_MANAGER,
      phone: '+91 98220 54321',
    },
  });

  const pm2 = await prisma.user.upsert({
    where: { email: 'nikhil.jagtap@moryaenterprises.com' },
    update: { name: 'Er. Nikhil Jagtap', role: Role.PROJECT_MANAGER },
    create: {
      email: 'nikhil.jagtap@moryaenterprises.com',
      passwordHash,
      name: 'Er. Nikhil Jagtap',
      role: Role.PROJECT_MANAGER,
      phone: '+91 98220 98765',
    },
  });

  // 2. Realistic Clients
  const clientsData = [
    { name: 'Vijay & Sunita Sharma', email: 'sharma.baner@example.com', address: 'Baner Hills, Pune' },
    { name: 'Apex Tech Solutions (Rohan Mehta)', email: 'rohan.mehta@apextech.example.com', address: 'Viman Nagar, Pune' },
    { name: 'Dr. Arvind Deshpande', email: 'dr.deshpande@example.com', address: 'Kothrud Green Valley, Pune' },
    { name: 'Kavita & Rajesh Iyer', email: 'iyer.family@example.com', address: 'Wakad Park Avenue, Pune' },
    { name: 'Omkar Traders (Pradeep Kadam)', email: 'omkar.traders@example.com', address: 'Hadapsar Industrial Zone, Pune' },
  ];

  const clientMap: Record<string, string> = {};
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { email: c.email },
      update: { name: c.name, address: c.address },
      create: { name: c.name, email: c.email, address: c.address },
    });
    clientMap[c.name] = client.id;
  }
  console.log(`[PASS] Initialized 5 construction clients in MySQL.`);

  // 3. Five Realistic Construction Projects (₹20,00,000 to ₹30,00,000)
  const projectsData = [
    {
      code: 'MORYA-PRJ-2026-001',
      name: 'Residential Building Construction',
      description: 'Ground plus 3-storey RCC residential building with foundation piling, brick masonry, and plumbing works.',
      type: ConstructionType.RESIDENTIAL,
      location: 'Baner Hills, Pune, Maharashtra',
      clientName: 'Vijay & Sunita Sharma',
      contractAmount: 2850000,
      approvedBudget: 2420000,
      plannedStart: new Date('2025-06-01'),
      expectedEnd: new Date('2026-05-30'),
      status: ProjectStatus.IN_PROGRESS,
      progress: 65,
      pmId: pm1.id,
    },
    {
      code: 'MORYA-PRJ-2026-002',
      name: 'Commercial Office Renovation',
      description: 'Complete interior renovation, glass partitioning, acoustic ceiling, electrical wiring, and HVAC ducting for tech office.',
      type: ConstructionType.COMMERCIAL,
      location: 'Viman Nagar, Pune, Maharashtra',
      clientName: 'Apex Tech Solutions (Rohan Mehta)',
      contractAmount: 2275000,
      approvedBudget: 1930000,
      plannedStart: new Date('2025-09-15'),
      expectedEnd: new Date('2026-03-31'),
      status: ProjectStatus.IN_PROGRESS,
      progress: 72,
      pmId: pm2.id,
    },
    {
      code: 'MORYA-PRJ-2026-003',
      name: 'Bungalow Construction',
      description: 'Custom independent luxury bungalow with RCC columns, teakwood finishing, waterproof terrace, and boundary landscaping.',
      type: ConstructionType.RESIDENTIAL,
      location: 'Kothrud Green Valley, Pune, Maharashtra',
      clientName: 'Dr. Arvind Deshpande',
      contractAmount: 3000000,
      approvedBudget: 2550000,
      plannedStart: new Date('2024-11-01'),
      expectedEnd: new Date('2026-02-28'),
      status: ProjectStatus.IN_PROGRESS,
      progress: 95,
      pmId: pm1.id,
    },
    {
      code: 'MORYA-PRJ-2026-004',
      name: 'Apartment Interior and Finishing',
      description: 'Full 3-BHK luxury apartment interior: Italian marble polishing, modular kitchen, POP false ceiling, and designer lighting.',
      type: ConstructionType.RENOVATION,
      location: 'Wakad Park Avenue, Pune, Maharashtra',
      clientName: 'Kavita & Rajesh Iyer',
      contractAmount: 2450000,
      approvedBudget: 2080000,
      plannedStart: new Date('2026-03-01'),
      expectedEnd: new Date('2026-08-31'),
      status: ProjectStatus.PLANNING,
      progress: 8,
      pmId: pm2.id,
    },
    {
      code: 'MORYA-PRJ-2026-005',
      name: 'Small Commercial Building',
      description: 'Two-storey commercial retail shop complex with steel structure, rolling shutters, and exterior weather-resistant paint.',
      type: ConstructionType.COMMERCIAL,
      location: 'Hadapsar Industrial Zone, Pune, Maharashtra',
      clientName: 'Omkar Traders (Pradeep Kadam)',
      contractAmount: 2080000,
      approvedBudget: 1760000,
      plannedStart: new Date('2024-08-15'),
      expectedEnd: new Date('2025-10-30'),
      status: ProjectStatus.COMPLETED,
      progress: 100,
      pmId: pm1.id,
    },
  ];

  for (const p of projectsData) {
    const clientId = clientMap[p.clientName];
    const project = await prisma.project.upsert({
      where: { projectCode: p.code },
      update: {
        name: p.name,
        description: p.description,
        constructionType: p.type,
        location: p.location,
        contractAmount: p.contractAmount,
        approvedBudget: p.approvedBudget,
        plannedStartDate: p.plannedStart,
        expectedCompletionDate: p.expectedEnd,
        status: p.status,
        progress: p.progress,
        clientId,
        projectManagerId: p.pmId,
      },
      create: {
        projectCode: p.code,
        name: p.name,
        description: p.description,
        constructionType: p.type,
        location: p.location,
        contractAmount: p.contractAmount,
        approvedBudget: p.approvedBudget,
        plannedStartDate: p.plannedStart,
        expectedCompletionDate: p.expectedEnd,
        status: p.status,
        progress: p.progress,
        clientId,
        projectManagerId: p.pmId,
      },
    });
    console.log(`[PASS] Seeded Project ${project.projectCode}: ${project.name}`);
  }

  console.log('--- DATABASE SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
