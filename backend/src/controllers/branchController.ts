import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { 
  demoBranches,
  getUserBranches,
  findBranchById,
  findUserByUsername
} from '@data/demoData';
import logger from '@utils/logger';
import { DailyBranchSession, BranchTransferRequest } from '@types/index';

// In-memory storage for demo (in production, use a database)
const dailySessions: Map<string, DailyBranchSession> = new Map();
const transferRequests: Map<string, BranchTransferRequest> = new Map();

export const getAllBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeBranches = demoBranches.filter(branch => branch.isActive);
    
    res.json({
      success: true,
      data: activeBranches
    });
  } catch (error) {
    logger.error('Get branches error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const getUserAvailableBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const user = findUserByUsername(req.user.username);
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const userBranches = getUserBranches(user.id);
    
    res.json({
      success: true,
      data: userBranches
    });
  } catch (error) {
    logger.error('Get user branches error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const selectDailyBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { branchId } = req.body;
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // Check if user already has a session today
    const existingSession = Array.from(dailySessions.values()).find(
      session => session.userId === userId && 
                 session.sessionDate === today && 
                 session.isLocked
    );

    if (existingSession) {
      res.status(400).json({
        success: false,
        error: 'คุณได้เลือกสาขาสำหรับวันนี้แล้ว',
        data: existingSession
      });
      return;
    }

    // Verify branch exists and user has access
    const branch = findBranchById(branchId);
    if (!branch) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบสาขาที่เลือก'
      });
      return;
    }

    const user = findUserByUsername(req.user.username);
    if (!user || !user.allowedBranches.includes(branchId)) {
      res.status(403).json({
        success: false,
        error: 'คุณไม่มีสิทธิ์เข้าถึงสาขานี้'
      });
      return;
    }

    // Create new session
    const sessionId = `session_${userId}_${Date.now()}`;
    const newSession: DailyBranchSession = {
      id: sessionId,
      userId,
      branchId,
      branchName: branch.name,
      sessionDate: today,
      startTime: new Date().toISOString(),
      isLocked: true
    };

    dailySessions.set(sessionId, newSession);

    logger.info(`User ${req.user.username} selected branch ${branch.name} for ${today}`);
    
    res.json({
      success: true,
      data: newSession,
      message: `เริ่มงานที่ ${branch.name} เรียบร้อยแล้ว`
    });
  } catch (error) {
    logger.error('Select branch error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const getCurrentSession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    const currentSession = Array.from(dailySessions.values()).find(
      session => session.userId === userId && 
                 session.sessionDate === today && 
                 session.isLocked
    );

    if (!currentSession) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลการทำงานสำหรับวันนี้'
      });
      return;
    }

    res.json({
      success: true,
      data: currentSession
    });
  } catch (error) {
    logger.error('Get session error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const endDailySession = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    const currentSession = Array.from(dailySessions.values()).find(
      session => session.userId === userId && 
                 session.sessionDate === today && 
                 session.isLocked
    );

    if (!currentSession) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบข้อมูลการทำงานสำหรับวันนี้'
      });
      return;
    }

    // Update session
    currentSession.endTime = new Date().toISOString();
    currentSession.isLocked = false;

    logger.info(`User ${req.user.username} ended session at ${currentSession.branchName}`);

    res.json({
      success: true,
      data: currentSession,
      message: 'สิ้นสุดวันทำงานเรียบร้อยแล้ว'
    });
  } catch (error) {
    logger.error('End session error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};

export const requestBranchTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        errors: errors.array()
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    const { toBranchId, reason } = req.body;
    const userId = req.user.userId;
    const today = new Date().toISOString().split('T')[0];

    // Get current session
    const currentSession = Array.from(dailySessions.values()).find(
      session => session.userId === userId && 
                 session.sessionDate === today && 
                 session.isLocked
    );

    if (!currentSession) {
      res.status(400).json({
        success: false,
        error: 'คุณต้องเลือกสาขาก่อนจึงจะขอย้ายได้'
      });
      return;
    }

    // Verify target branch
    const targetBranch = findBranchById(toBranchId);
    if (!targetBranch) {
      res.status(404).json({
        success: false,
        error: 'ไม่พบสาขาที่ต้องการย้ายไป'
      });
      return;
    }

    // Create transfer request
    const requestId = `transfer_${userId}_${Date.now()}`;
    const transferRequest: BranchTransferRequest = {
      id: requestId,
      userId,
      fromBranchId: currentSession.branchId,
      toBranchId,
      reason,
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    transferRequests.set(requestId, transferRequest);

    logger.info(`User ${req.user.username} requested transfer from ${currentSession.branchName} to ${targetBranch.name}`);

    res.json({
      success: true,
      data: transferRequest,
      message: `ส่งคำขอย้ายไป ${targetBranch.name} เรียบร้อยแล้ว`
    });
  } catch (error) {
    logger.error('Transfer request error:', error);
    res.status(500).json({
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ'
    });
  }
};