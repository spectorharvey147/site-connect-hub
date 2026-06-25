import { createContext } from "react";

import type {
  AppUser,
  AuthSession,
  InitialAdminInput,
  LoginCredentials,
} from "@/types/auth";

export interface AuthContextValue {
  user: AppUser | null;
  session: AuthSession | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  createInitialAdmin: (input: InitialAdminInput) => Promise<void>;
  refreshSession: () => Promise<void>;
  updateCurrentUser?: (user: AppUser) => void;
}

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
