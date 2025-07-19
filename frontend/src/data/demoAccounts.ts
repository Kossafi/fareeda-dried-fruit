import { User, UserRole, Branch } from '@types/index';

// Demo Employee Accounts
export interface DemoEmployee {
  id: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  allowedBranches: string[];
  employeeId: string;
  email?: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Demo Branches Data
export const demoBranches: Branch[] = [
  {
    id: 'branch-central-ladprao',
    name: 'เซ็นทรัลลาดพร้าว',
    location: 'ชั้น 1 เซ็นทรัลลาดพร้าว (Zone A)',
    code: 'CLP',
    address: '1693 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพมหานคร 10900',
    currentStaffCount: 2,
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'branch-siam-paragon',
    name: 'สยามพารากอน',
    location: 'ชั้น B1 สยามพารากอน (Gourmet Market)',
    code: 'SPG',
    address: '991 ถนนพระราม 1 แขวงปทุมวัน เขตปทุมวัน กรุงเทพมหานคร 10330',
    currentStaffCount: 1,
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'branch-emquartier',
    name: 'เอ็มควอเทียร์',
    location: 'ชั้น G เอ็มควอเทียร์ (The Helix)',
    code: 'EMQ',
    address: '693 ถนนสุขุมวิท แขวงคลองตัน เขตคลองเตย กรุงเทพมหานคร 10110',
    currentStaffCount: 1,
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  }
];

// Demo Employee Accounts
export const demoEmployees: DemoEmployee[] = [
  {
    id: 'emp-001',
    username: 'staff001',
    password: '123456',
    firstName: 'สมใจ',
    lastName: 'ใจดี',
    role: UserRole.STAFF,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon'],
    employeeId: 'EMP001',
    email: 'somjai.jaidee@fareedadriedfruits.com',
    phone: '081-234-5678',
    avatar: '👩‍💼',
    isActive: true,
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'emp-002',
    username: 'staff002',
    password: '123456',
    firstName: 'สมศรี',
    lastName: 'ใสใจ',
    role: UserRole.STAFF,
    allowedBranches: ['branch-siam-paragon', 'branch-emquartier'],
    employeeId: 'EMP002',
    email: 'somsri.saijai@fareedadriedfruits.com',
    phone: '081-345-6789',
    avatar: '👨‍💼',
    isActive: true,
    createdAt: '2024-02-01T09:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'emp-003',
    username: 'staff003',
    password: '123456',
    firstName: 'สุภาพ',
    lastName: 'ขยันดี',
    role: UserRole.STAFF,
    allowedBranches: ['branch-central-ladprao'],
    employeeId: 'EMP003',
    email: 'supap.khayanadee@fareedadriedfruits.com',
    phone: '081-456-7890',
    avatar: '👩‍🔧',
    isActive: true,
    createdAt: '2024-03-01T09:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'mgr-001',
    username: 'manager001',
    password: '123456',
    firstName: 'สมชาย',
    lastName: 'จัดการ',
    role: UserRole.MANAGER,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon', 'branch-emquartier'],
    employeeId: 'MGR001',
    email: 'somchai.jadkarn@fareedadriedfruits.com',
    phone: '081-567-8901',
    avatar: '👔',
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'mgr-002',
    username: 'manager002',
    password: '123456',
    firstName: 'สมหญิง',
    lastName: 'บริหาร',
    role: UserRole.MANAGER,
    allowedBranches: ['branch-siam-paragon', 'branch-emquartier'],
    employeeId: 'MGR002',
    email: 'somying.borihan@fareedadriedfruits.com',
    phone: '081-678-9012',
    avatar: '👩‍💼',
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  },
  {
    id: 'admin-001',
    username: 'admin',
    password: 'admin123',
    firstName: 'ผู้ดูแล',
    lastName: 'ระบบ',
    role: UserRole.ADMIN,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon', 'branch-emquartier'],
    employeeId: 'ADMIN001',
    email: 'admin@fareedadriedfruits.com',
    phone: '081-789-0123',
    avatar: '👨‍💻',
    isActive: true,
    createdAt: '2024-01-01T08:00:00.000Z',
    updatedAt: '2024-07-19T08:00:00.000Z'
  }
];

// Convert DemoEmployee to User format
export const convertToUser = (employee: DemoEmployee, branchId?: string): User => {
  const selectedBranch = branchId ? demoBranches.find(b => b.id === branchId) : null;
  
  return {
    id: employee.id,
    username: employee.username,
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email || `${employee.username}@fareedadriedfruits.com`,
    role: employee.role,
    branchId: branchId || employee.allowedBranches[0],
    branch: selectedBranch || demoBranches.find(b => b.id === employee.allowedBranches[0]),
    employeeId: employee.employeeId,
    phone: employee.phone,
    isActive: employee.isActive,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt
  };
};

// Authenticate demo user
export const authenticateDemoUser = (username: string, password: string): DemoEmployee | null => {
  const employee = demoEmployees.find(emp => 
    emp.username === username && 
    emp.password === password && 
    emp.isActive
  );
  
  return employee || null;
};

// Get branches accessible by employee
export const getEmployeeBranches = (employeeId: string): Branch[] => {
  const employee = demoEmployees.find(emp => emp.id === employeeId);
  if (!employee) return [];
  
  return demoBranches.filter(branch => 
    employee.allowedBranches.includes(branch.id) && branch.isActive
  );
};

// Get employee info
export const getEmployeeInfo = (username: string): DemoEmployee | null => {
  return demoEmployees.find(emp => emp.username === username) || null;
};

// Check if employee can access branch
export const canEmployeeAccessBranch = (employeeId: string, branchId: string): boolean => {
  const employee = demoEmployees.find(emp => emp.id === employeeId);
  if (!employee) return false;
  
  return employee.allowedBranches.includes(branchId);
};

// Get all active branches
export const getAllBranches = (): Branch[] => {
  return demoBranches.filter(branch => branch.isActive);
};

// Get branch by ID
export const getBranchById = (branchId: string): Branch | null => {
  return demoBranches.find(branch => branch.id === branchId) || null;
};