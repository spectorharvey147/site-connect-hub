export type NotificationType =
  | "claim"
  | "leave"
  | "task"
  | "message"
  | "payment"
  | "vendor"
  | "material"
  | "system";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  relatedId?: string;
  relatedType?: string;
  readAt?: string;
  createdAt: string;
}
