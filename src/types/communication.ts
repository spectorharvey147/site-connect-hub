export type DeliveryStatus = "pending" | "awaiting_approval" | "processing" | "sent" | "failed" | "cancelled" | "suppressed";
export interface CommunicationGateway { id:string; displayName:string; status:string; linkedNumber?:string; lastSeenAt?:string; paused:boolean }
export interface CommunicationMapping { id:string; projectId:string; projectName:string; projectCode:string; gatewayId:string; destinationGroupId:string; destinationGroupName:string; participantCount:number; dprEnabled:boolean; active:boolean; lastSyncedAt?:string }
export interface CommunicationRule { id:string; eventType:string; enabled:boolean; approvalRequired:boolean; deliveryMode:string; maxAttempts:number; priority:number }
export interface CommunicationTemplate { id:string; templateName:string; eventType:string; content:string; isActive:boolean }
export interface CommunicationDelivery { id:string; createdAt:string; eventType:string; projectId:string; destination?:string; messageType:string; status:DeliveryStatus; attemptCount:number; providerMessageId?:string; lastError?:string }
export interface CommunicationLog { id:string; createdAt:string; gatewayId?:string; level:string; eventType:string; message:string }
