export interface EmployeeAdvance{ id:string;employeeId:string;type:"opening_balance"|"rolling_advance"|"temporary_advance"|"adjustment";date:string;amount:number;reference?:string;remarks?:string;createdAt:string }
export interface FinanceLedgerEntry{id:string;employeeId:string;date:string;type:string;referenceType:string;referenceId:string;debit:number;credit:number;balance:number;remarks?:string;createdBy?:string}
export interface EmployeeFinanceSummary{employeeId:string;employeeName:string;opening:number;advance:number;submitted:number;approved:number;deducted:number;paid:number;availableBalance:number;outstanding:number}
export interface UserSignature{id:string;userId:string;path:string;name:string;isActive:boolean;createdAt:string;signedUrl?:string}
