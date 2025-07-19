export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  email?: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  branch?: Branch;
  allowedBranches: string[];
  isActive: boolean;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  location: string;
  isActive: boolean;
  managerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  needsBranchSelection?: boolean;
}

export interface DailyBranchSession {
  id: string;
  userId: string;
  branchId: string;
  branchName: string;
  sessionDate: string;
  startTime: string;
  endTime?: string;
  isLocked: boolean;
}

export interface BranchTransferRequest {
  id: string;
  userId: string;
  fromBranchId: string;
  toBranchId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}