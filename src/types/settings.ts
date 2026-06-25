export interface CompanySettings {
  companyName: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  timezone: string;
  fiscalYearStart: string;
  logoUrl: string;
}

export interface WorkflowSettings {
  claimAdminVerificationRequired: boolean;
  claimManagerApprovalLimit: number;
  claimFinalApprovalLimit: number;
  leaveManagerApprovalRequired: boolean;
  vendorBillAutoVoucher: boolean;
  attendanceGeoFenceMeters: number;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  emailEvents: Record<string, boolean>;
  pushEnabled: boolean;
  dailyDigestTime: string;
  escalationHours: number;
}

export interface MasterSettings {
  defaultProjectId: string;
  defaultShiftId: string;
  defaultLeavePolicy: string;
  defaultPaymentTerms: string;
}

export interface AppSettings {
  company: CompanySettings;
  workflow: WorkflowSettings;
  notifications: NotificationSettings;
  masters: MasterSettings;
  updatedAt: string;
  updatedBy?: string;
}
