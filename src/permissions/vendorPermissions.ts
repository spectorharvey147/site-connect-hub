import type { AppUser } from "@/types/auth";

export function canViewVendors(user: AppUser) {
  return ["manager", "hod", "admin_hr", "super_admin", "accounts_officer"].includes(user.role);
}

export function canManageVendorMaster(user: AppUser) {
  return ["admin_hr", "super_admin"].includes(user.role);
}

export function canCreateVendorBill(user: AppUser) {
  return ["manager", "hod", "admin_hr"].includes(user.role);
}

export function canVerifyVendorBill(user: AppUser) {
  return user.role === "admin_hr";
}

export function canApproveVendorBill(user: AppUser) {
  return ["manager", "hod", "super_admin"].includes(user.role);
}

export function canGenerateVendorVoucher(user: AppUser) {
  return ["accounts_officer", "super_admin"].includes(user.role);
}

export function canRecordVendorPayment(user: AppUser) {
  return ["accounts_officer", "super_admin"].includes(user.role);
}
