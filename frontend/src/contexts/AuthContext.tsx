import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, LoginRequest, LoginResponse, UserRole, Branch } from '@types/index';
import { authenticateDemoUser, convertToUser, demoBranches, getEmployeeBranches } from '@data/demoAccounts';
import apiClient from '@services/api';
import toast from 'react-hot-toast';

// Daily Branch Session
interface DailyBranchSession {
  branchId: string;
  branchName: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;
  endTime: string | null;
  isLocked: boolean;
  transferRequests: BranchTransferRequest[];
}

// Branch Transfer Request
interface BranchTransferRequest {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Auth State
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  // Branch session management
  availableBranches: Branch[];
  dailySession: DailyBranchSession | null;
  needsBranchSelection: boolean;
  transferRequest: BranchTransferRequest | null;
}

// Auth Actions
type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_AVAILABLE_BRANCHES'; payload: Branch[] }
  | { type: 'REQUIRE_BRANCH_SELECTION' }
  | { type: 'SET_DAILY_SESSION'; payload: DailyBranchSession }
  | { type: 'END_DAILY_SESSION' }
  | { type: 'SET_TRANSFER_REQUEST'; payload: BranchTransferRequest | null }
  | { type: 'CLEAR_BRANCH_SELECTION' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  availableBranches: [],
  dailySession: null,
  needsBranchSelection: false,
  transferRequest: null,
};

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        loading: false,
      };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };
    case 'SET_AVAILABLE_BRANCHES':
      return {
        ...state,
        availableBranches: action.payload,
      };
    case 'REQUIRE_BRANCH_SELECTION':
      return {
        ...state,
        needsBranchSelection: true,
      };
    case 'SET_DAILY_SESSION':
      return {
        ...state,
        dailySession: action.payload,
        needsBranchSelection: false,
      };
    case 'END_DAILY_SESSION':
      return {
        ...state,
        dailySession: null,
        needsBranchSelection: false,
      };
    case 'SET_TRANSFER_REQUEST':
      return {
        ...state,
        transferRequest: action.payload,
      };
    case 'CLEAR_BRANCH_SELECTION':
      return {
        ...state,
        needsBranchSelection: false,
        availableBranches: [],
      };
    default:
      return state;
  }
}

// Auth Context
interface AuthContextType {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  
  // Branch Management
  availableBranches: Branch[];
  dailySession: DailyBranchSession | null;
  needsBranchSelection: boolean;
  transferRequest: BranchTransferRequest | null;
  
  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
  clearError: () => void;
  
  // Branch Actions
  loadAvailableBranches: () => Promise<void>;
  selectDailyBranch: (branchId: string) => Promise<void>;
  endDailySession: () => Promise<void>;
  requestBranchTransfer: (toBranchId: string, reason: string) => Promise<void>;
  approveBranchTransfer: (requestId: string) => Promise<void>;
  rejectBranchTransfer: (requestId: string) => Promise<void>;
  checkDailySession: () => Promise<void>;
  
  // Utilities
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  canAccessBranch: (branchId?: string) => boolean;
  getCurrentBranch: () => Branch | null;
  isSessionLocked: () => boolean;
  canTransferBranch: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth Provider Props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth Provider Component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('authToken');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          apiClient.setAuthToken(token);
          
          // Verify token is still valid
          await refreshUser();
          
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token }
          });
          
          // Check for existing daily session
          await checkDailySession();
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          apiClient.clearAuthToken();
          dispatch({ type: 'LOGOUT' });
        }
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, []);

  // Login function
  const login = async (credentials: LoginRequest): Promise<void> => {
    try {
      dispatch({ type: 'LOGIN_START' });
      
      // Try demo authentication first
      const demoEmployee = authenticateDemoUser(credentials.username, credentials.password);
      
      if (demoEmployee) {
        // Demo authentication successful
        const user = convertToUser(demoEmployee);
        const token = `demo_token_${demoEmployee.id}_${Date.now()}`;
        
        // Store in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('demoEmployee', JSON.stringify(demoEmployee));
        
        // Update state
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });
        
        // After successful login, check if user needs to select branch
        await checkDailySession();
        
        toast.success(`ยินดีต้อนรับ ${user.firstName} ${user.lastName}!`);
        return;
      }
      
      // Fallback to regular API authentication
      const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
      
      if (response.success && response.data) {
        const { user, token } = response.data;
        
        // Store in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        // Set API client token
        apiClient.setAuthToken(token);
        
        // Update state
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token }
        });
        
        // After successful login, check if user needs to select branch
        await checkDailySession();
        
        toast.success(`ยินดีต้อนรับ ${user.username}!`);
      } else {
        throw new Error(response.error || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      });
      
      toast.error(errorMessage);
      throw error;
    }
  };

  // Logout function
  const logout = (): void => {
    try {
      // End daily session if exists
      if (state.dailySession) {
        endDailySession();
      }
      
      // Clear localStorage
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('dailySession');
      localStorage.removeItem('demoEmployee');
      
      // Clear API client token
      apiClient.clearAuthToken();
      
      // Update state
      dispatch({ type: 'LOGOUT' });
      
      toast.success('ออกจากระบบเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Refresh user data
  const refreshUser = async (): Promise<void> => {
    try {
      const response = await apiClient.get<User>('/auth/me');
      
      if (response.success && response.data) {
        const user = response.data;
        localStorage.setItem('user', JSON.stringify(user));
        dispatch({ type: 'SET_USER', payload: user });
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      throw error;
    }
  };

  // Update user data
  const updateUser = (user: User): void => {
    localStorage.setItem('user', JSON.stringify(user));
    dispatch({ type: 'SET_USER', payload: user });
  };

  // Clear error
  const clearError = (): void => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Role checking utilities
  const hasRole = (role: UserRole): boolean => {
    return state.user?.role === role;
  };

  const hasAnyRole = (roles: UserRole[]): boolean => {
    return state.user ? roles.includes(state.user.role) : false;
  };

  const canAccessBranch = (branchId?: string): boolean => {
    if (!state.user) return false;
    
    // Admin can access all branches
    if (state.user.role === UserRole.ADMIN) return true;
    
    // Other users can only access their own branch
    if (!branchId) return true; // No specific branch required
    return state.user.branchId === branchId;
  };

  // Branch Management Functions
  const loadAvailableBranches = async (): Promise<void> => {
    try {
      // Check if user is demo user
      const demoEmployeeStr = localStorage.getItem('demoEmployee');
      
      if (demoEmployeeStr && state.user) {
        // Load branches for demo employee
        const demoEmployee = JSON.parse(demoEmployeeStr);
        const employeeBranches = getEmployeeBranches(demoEmployee.id);
        
        dispatch({ type: 'SET_AVAILABLE_BRANCHES', payload: employeeBranches });
        return;
      }
      
      // Fallback to regular API call or all demo branches
      const allBranches = demoBranches.filter(branch => branch.isActive);
      dispatch({ type: 'SET_AVAILABLE_BRANCHES', payload: allBranches });
      
    } catch (error) {
      console.error('Failed to load branches:', error);
      toast.error('ไม่สามารถโหลดข้อมูลสาขาได้');
    }
  };

  const selectDailyBranch = async (branchId: string): Promise<void> => {
    try {
      if (!state.user) throw new Error('User not authenticated');
      
      const selectedBranch = state.availableBranches.find(b => b.id === branchId);
      if (!selectedBranch) throw new Error('Branch not found');
      
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();
      
      const session: DailyBranchSession = {
        branchId,
        branchName: selectedBranch.name,
        sessionDate: today,
        startTime: now,
        endTime: null,
        isLocked: true,
        transferRequests: []
      };
      
      // Store in localStorage for persistence
      localStorage.setItem('dailySession', JSON.stringify(session));
      
      dispatch({ type: 'SET_DAILY_SESSION', payload: session });
      
      toast.success(`เริ่มงานที่ ${selectedBranch.name} เรียบร้อยแล้ว`);
    } catch (error: any) {
      console.error('Failed to select branch:', error);
      toast.error(error.message || 'ไม่สามารถเลือกสาขาได้');
      throw error;
    }
  };

  const endDailySession = async (): Promise<void> => {
    try {
      if (!state.dailySession) return;
      
      const updatedSession = {
        ...state.dailySession,
        endTime: new Date().toISOString(),
        isLocked: false
      };
      
      // Store final session data
      localStorage.setItem('dailySession', JSON.stringify(updatedSession));
      
      dispatch({ type: 'END_DAILY_SESSION' });
      
      toast.success('สิ้นสุดวันทำงานเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('ไม่สามารถสิ้นสุดวันทำงานได้');
    }
  };

  const requestBranchTransfer = async (toBranchId: string, reason: string): Promise<void> => {
    try {
      if (!state.user || !state.dailySession) {
        throw new Error('Invalid session state');
      }
      
      const targetBranch = state.availableBranches.find(b => b.id === toBranchId);
      if (!targetBranch) throw new Error('Target branch not found');
      
      const transferRequest: BranchTransferRequest = {
        id: `tr_${Date.now()}`,
        fromBranchId: state.dailySession.branchId,
        toBranchId,
        reason,
        status: 'pending',
        requestedAt: new Date().toISOString()
      };
      
      dispatch({ type: 'SET_TRANSFER_REQUEST', payload: transferRequest });
      
      toast.success(`ส่งคำขอย้ายไป ${targetBranch.name} เรียบร้อยแล้ว`);
    } catch (error: any) {
      console.error('Failed to request transfer:', error);
      toast.error(error.message || 'ไม่สามารถส่งคำขอย้ายสาขาได้');
      throw error;
    }
  };

  const approveBranchTransfer = async (requestId: string): Promise<void> => {
    try {
      if (!state.transferRequest || state.transferRequest.id !== requestId) {
        throw new Error('Transfer request not found');
      }
      
      // Approve the transfer - end current session and require new branch selection
      await endDailySession();
      dispatch({ type: 'SET_TRANSFER_REQUEST', payload: null });
      dispatch({ type: 'REQUIRE_BRANCH_SELECTION' });
      
      toast.success('อนุมัติการย้ายสาขาเรียบร้อย กรุณาเลือกสาขาใหม่');
    } catch (error: any) {
      console.error('Failed to approve transfer:', error);
      toast.error(error.message || 'ไม่สามารถอนุมัติการย้ายสาขาได้');
      throw error;
    }
  };

  const rejectBranchTransfer = async (requestId: string): Promise<void> => {
    try {
      if (!state.transferRequest || state.transferRequest.id !== requestId) {
        throw new Error('Transfer request not found');
      }
      
      dispatch({ type: 'SET_TRANSFER_REQUEST', payload: null });
      
      toast.info('ปฏิเสธการย้ายสาขา');
    } catch (error: any) {
      console.error('Failed to reject transfer:', error);
      toast.error(error.message || 'ไม่สามารถปฏิเสธการย้ายสาขาได้');
      throw error;
    }
  };

  const checkDailySession = async (): Promise<void> => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storedSession = localStorage.getItem('dailySession');
      
      if (storedSession) {
        const session: DailyBranchSession = JSON.parse(storedSession);
        
        // Check if session is for today
        if (session.sessionDate === today && session.isLocked) {
          dispatch({ type: 'SET_DAILY_SESSION', payload: session });
          return;
        }
      }
      
      // No valid session found - require branch selection
      await loadAvailableBranches();
      dispatch({ type: 'REQUIRE_BRANCH_SELECTION' });
    } catch (error) {
      console.error('Failed to check daily session:', error);
      // Fallback to requiring branch selection
      await loadAvailableBranches();
      dispatch({ type: 'REQUIRE_BRANCH_SELECTION' });
    }
  };

  // Utility functions
  const getCurrentBranch = (): Branch | null => {
    if (!state.dailySession) return null;
    return state.availableBranches.find(b => b.id === state.dailySession!.branchId) || null;
  };

  const isSessionLocked = (): boolean => {
    return state.dailySession?.isLocked || false;
  };

  const canTransferBranch = (): boolean => {
    return isSessionLocked() && !state.transferRequest && 
           (state.user?.role === UserRole.ADMIN || state.user?.role === UserRole.MANAGER);
  };

  const contextValue: AuthContextType = {
    // State
    user: state.user,
    token: state.token,
    isAuthenticated: state.isAuthenticated,
    loading: state.loading,
    error: state.error,
    
    // Branch Management
    availableBranches: state.availableBranches,
    dailySession: state.dailySession,
    needsBranchSelection: state.needsBranchSelection,
    transferRequest: state.transferRequest,
    
    // Actions
    login,
    logout,
    refreshUser,
    updateUser,
    clearError,
    
    // Branch Actions
    loadAvailableBranches,
    selectDailyBranch,
    endDailySession,
    requestBranchTransfer,
    approveBranchTransfer,
    rejectBranchTransfer,
    checkDailySession,
    
    // Utilities
    hasRole,
    hasAnyRole,
    canAccessBranch,
    getCurrentBranch,
    isSessionLocked,
    canTransferBranch,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;