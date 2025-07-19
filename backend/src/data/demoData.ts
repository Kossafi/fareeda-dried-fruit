import { User, Branch, UserRole } from '@types/index';
import bcrypt from 'bcryptjs';

// Demo branches data
export const demoBranches: Branch[] = [
  {
    id: 'branch-central-ladprao',
    code: 'CLP',
    name: 'Central Ladprao',
    location: 'ชั้น 3 เซ็นทรัลลาดพร้าว',
    isActive: true,
    managerId: 'emp-004',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'branch-siam-paragon',
    code: 'SPG',
    name: 'Siam Paragon',
    location: 'ชั้น G สยามพารากอน',
    isActive: true,
    managerId: 'emp-005',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'branch-emquartier',
    code: 'EMQ',
    name: 'EmQuartier',
    location: 'ชั้น M เอ็มควอเทียร์',
    isActive: true,
    managerId: 'emp-005',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

// Demo employees data with hashed passwords
export const demoEmployees: User[] = [
  {
    id: 'emp-001',
    username: 'staff001',
    firstName: 'สมใจ',
    lastName: 'ใจดี',
    employeeId: 'EMP001',
    email: 'somjai@example.com',
    phone: '081-234-5678',
    role: UserRole.STAFF,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon'],
    isActive: true,
    avatar: '👩',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'emp-002',
    username: 'staff002',
    firstName: 'มานะ',
    lastName: 'ขยัน',
    employeeId: 'EMP002',
    email: 'mana@example.com',
    phone: '082-345-6789',
    role: UserRole.STAFF,
    allowedBranches: ['branch-siam-paragon', 'branch-emquartier'],
    isActive: true,
    avatar: '👨',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'emp-003',
    username: 'staff003',
    firstName: 'สุภา',
    lastName: 'รักงาน',
    employeeId: 'EMP003',
    email: 'supa@example.com',
    phone: '083-456-7890',
    role: UserRole.STAFF,
    allowedBranches: ['branch-emquartier'],
    isActive: true,
    avatar: '👩',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'emp-004',
    username: 'manager001',
    firstName: 'วิชัย',
    lastName: 'จัดการดี',
    employeeId: 'MGR001',
    email: 'wichai@example.com',
    phone: '084-567-8901',
    role: UserRole.MANAGER,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon', 'branch-emquartier'],
    isActive: true,
    avatar: '👨‍💼',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'emp-005',
    username: 'manager002',
    firstName: 'ปราณี',
    lastName: 'ผู้นำทีม',
    employeeId: 'MGR002',
    email: 'pranee@example.com',
    phone: '085-678-9012',
    role: UserRole.MANAGER,
    allowedBranches: ['branch-siam-paragon', 'branch-emquartier'],
    isActive: true,
    avatar: '👩‍💼',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'emp-006',
    username: 'admin',
    firstName: 'ธนา',
    lastName: 'ผู้ดูแล',
    employeeId: 'ADM001',
    email: 'admin@example.com',
    phone: '086-789-0123',
    role: UserRole.ADMIN,
    allowedBranches: ['branch-central-ladprao', 'branch-siam-paragon', 'branch-emquartier'],
    isActive: true,
    avatar: '👤',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
];

// Password hash map for demo accounts (in production, these would be in a database)
export const demoPasswords: Record<string, string> = {
  'staff001': bcrypt.hashSync('123456', 10),
  'staff002': bcrypt.hashSync('123456', 10),
  'staff003': bcrypt.hashSync('123456', 10),
  'manager001': bcrypt.hashSync('123456', 10),
  'manager002': bcrypt.hashSync('123456', 10),
  'admin': bcrypt.hashSync('admin123', 10)
};

// Helper functions
export const findUserByUsername = (username: string): User | undefined => {
  return demoEmployees.find(emp => emp.username === username);
};

export const findBranchById = (branchId: string): Branch | undefined => {
  return demoBranches.find(branch => branch.id === branchId);
};

export const getUserBranches = (userId: string): Branch[] => {
  const user = demoEmployees.find(emp => emp.id === userId);
  if (!user) return [];
  
  return demoBranches.filter(branch => 
    user.allowedBranches.includes(branch.id) && branch.isActive
  );
};

export const validateUserPassword = (username: string, password: string): boolean => {
  const hashedPassword = demoPasswords[username];
  if (!hashedPassword) return false;
  
  return bcrypt.compareSync(password, hashedPassword);
};