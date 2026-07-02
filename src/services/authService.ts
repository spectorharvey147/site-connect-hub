import { recordAuditLog } from "@/services/auditService";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type {
  AppUser,
  AuthSession,
  InitialAdminInput,
  LoginCredentials,
  ResetPasswordInput,
} from "@/types/auth";

const SESSION_STORAGE_KEY = "site-connect:session";
const REMEMBERED_IDENTIFIER_KEY = "site-connect:remembered-identifier";

interface SupabaseProfile {
  id: string;
  organization_id: string | null;
  employee_id: string | null;
  employee_code: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_id: AppUser["role"];
  manager_id: string | null;
  reporting_manager_id: string | null;
  department: string | null;
  department_id: string | null;
  designation_id: string | null;
  hod_user_id: string | null;
  primary_project_id: string | null;
  employment_type: AppUser["employmentType"] | null;
  joining_date: string | null;
  avatar_url: string | null;
  profile_photo_url: string | null;
  profile_photo_path: string | null;
  signature_url: string | null;
  signature_path: string | null;
  status: AppUser["status"];
}

function createSession(user: AppUser, accessToken: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    user,
    accessToken,
    expiresAt,
  };
}

function persistSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearPersistedSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

function isSessionFresh(session: AuthSession) {
  return new Date(session.expiresAt).getTime() > Date.now();
}

function readPersistedSession() {
  const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) return null;
  try {
    const session = JSON.parse(stored) as AuthSession;
    return isSessionFresh(session) ? session : null;
  } catch {
    return null;
  }
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number) {
  let timeoutId: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("Session lookup timed out.")),
          milliseconds,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function rememberIdentifier(identifier: string, rememberMe: boolean) {
  if (rememberMe) {
    window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier.trim());
    return;
  }

  window.localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
}

async function fetchSupabaseProfile(
  userId: string,
  email: string | undefined,
): Promise<AppUser> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      [
        "id",
        "organization_id",
        "employee_id",
        "employee_code",
        "first_name",
        "last_name",
        "full_name",
        "email",
        "phone",
        "role_id",
        "manager_id",
        "reporting_manager_id",
        "department",
        "department_id",
        "designation_id",
        "hod_user_id",
        "primary_project_id",
        "employment_type",
        "joining_date",
        "avatar_url",
        "profile_photo_url",
        "profile_photo_path",
        "signature_url",
        "signature_path",
        "status",
      ].join(", "),
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const profile = data as SupabaseProfile | null;
  if (!profile) {
    throw new Error("No user profile exists for this account.");
  }

  const employeeId = profile.employee_code ?? profile.employee_id ?? "";
  let avatarUrl = profile.profile_photo_url ?? profile.avatar_url ?? undefined;
  let signatureUrl = profile.signature_url ?? undefined;
  if (profile.profile_photo_path) {
    const { data } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.profile_photo_path, 3600);
    avatarUrl = data?.signedUrl ?? avatarUrl;
  }
  if (profile.signature_path) {
    const { data } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(profile.signature_path, 3600);
    signatureUrl = data?.signedUrl ?? signatureUrl;
  }
  return {
    id: profile.id,
    organizationId: profile.organization_id ?? undefined,
    employeeId,
    employeeCode: profile.employee_code ?? employeeId,
    firstName: profile.first_name ?? undefined,
    lastName: profile.last_name ?? undefined,
    fullName: profile.full_name,
    email: profile.email ?? email ?? "",
    phone: profile.phone ?? undefined,
    role: profile.role_id,
    managerId: profile.reporting_manager_id ?? profile.manager_id ?? undefined,
    reportingManagerId: profile.reporting_manager_id ?? profile.manager_id ?? undefined,
    department: profile.department ?? undefined,
    departmentId: profile.department_id ?? undefined,
    designationId: profile.designation_id ?? undefined,
    hodUserId: profile.hod_user_id ?? undefined,
    primaryProjectId: profile.primary_project_id ?? undefined,
    employmentType: profile.employment_type ?? undefined,
    joiningDate: profile.joining_date ?? undefined,
    avatarUrl,
    profilePhotoPath: profile.profile_photo_path ?? undefined,
    signatureUrl,
    signaturePath: profile.signature_path ?? undefined,
    status: profile.status,
    projectIds: profile.primary_project_id ? [profile.primary_project_id] : [],
  };
}

export const authService = {
  persistUpdatedSession(session: AuthSession) {
    persistSession(session);
  },

  getRememberedIdentifier() {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? "";
  },

  async getCurrentSession(): Promise<AuthSession | null> {
    if (typeof window === "undefined") {
      return null;
    }

    if (isSupabaseConfigured && supabase) {
      const persisted = readPersistedSession();
      if (persisted) {
        return persisted;
      }
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          5000,
        );
        if (error) throw error;
        if (data.session?.user) {
          const user = await withTimeout(
            fetchSupabaseProfile(
              data.session.user.id,
              data.session.user.email,
            ),
            5000,
          );
          const session = createSession(user, data.session.access_token);
          persistSession(session);
          return session;
        }
      } catch {
        const fallback = readPersistedSession();
        if (fallback) return fallback;
      }
      clearPersistedSession();
      return null;
    }

    clearPersistedSession();
    return null;
  },

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const identifier = normalizeIdentifier(credentials.identifier);

    if (isSupabaseConfigured && supabase) {
      if (!identifier.includes("@")) {
        throw new Error("Use your email address to sign in.");
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password: credentials.password,
      });

      if (error || !data.session?.user) {
        throw new Error(error?.message ?? "Unable to sign in.");
      }

      const user = await fetchSupabaseProfile(
        data.session.user.id,
        data.session.user.email,
      );
      const session = createSession(user, data.session.access_token);
      persistSession(session);
      rememberIdentifier(credentials.identifier, credentials.rememberMe);
      await recordAuditLog({
        userId: user.id,
        action: "auth.login",
        entityType: "session",
        newValues: { provider: "supabase" },
      });
      return session;
    }

    throw new Error("Production authentication is not configured.");
  },

  async logout(userId?: string) {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }

    clearPersistedSession();

    if (userId) {
      await recordAuditLog({
        userId,
        action: "auth.logout",
        entityType: "session",
      });
    }
  },

  async requestPasswordReset(email: string) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return {
      message: "If the email exists, a reset link will be sent.",
    };
  },

  async resetPassword(input: ResetPasswordInput) {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({
        password: input.password,
      });

      if (error) {
        throw new Error(error.message);
      }
      const { error: activationError } = await supabase.rpc(
        "activate_current_user_after_password_setup",
      );
      if (activationError) {
        throw new Error(activationError.message);
      }
    }

    return {
      message: "Password reset complete.",
    };
  },

  async establishPasswordRecoverySession(url = window.location.href) {
    if (!isSupabaseConfigured || !supabase) {
      return true;
    }

    const currentSession = await supabase.auth.getSession();
    if (currentSession.data.session) {
      return true;
    }

    const parsedUrl = new URL(url);
    const code = parsedUrl.searchParams.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        throw new Error(error.message);
      }
      return true;
    }

    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ""));
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        throw new Error(error.message);
      }
      return true;
    }

    return false;
  },

  async checkIfAdminExists() {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc("has_initial_admin");

      if (error) {
        throw new Error(error.message);
      }

      return data === true;
    }

    throw new Error("Production authentication is not configured.");
  },

  async createInitialAdmin(input: InitialAdminInput): Promise<AuthSession> {
    if (await this.checkIfAdminExists()) {
      throw new Error("An admin already exists.");
    }

    if (isSupabaseConfigured) {
      if (!supabase) {
        throw new Error("Supabase is not configured.");
      }
      const { error: setupError } = await supabase.functions.invoke(
        "setup-initial-admin",
        { body: input },
      );
      if (setupError) {
        const context = setupError.context as
          | { json?: () => Promise<unknown>; text?: () => Promise<string> }
          | undefined;
        const detail = await context
          ?.json?.()
          .then((body) => {
            if (body && typeof body === "object" && "error" in body) {
              return String((body as { error?: unknown }).error);
            }
            return "";
          })
          .catch(() => "");
        throw new Error(detail || setupError.message);
      }
      const { data, error: loginError } = await supabase.auth.signInWithPassword({
        email: input.email.trim().toLowerCase(),
        password: input.password,
      });
      if (loginError || !data.session?.user) {
        throw new Error(loginError?.message ?? "Setup completed, but sign-in failed.");
      }
      const createdUser = await fetchSupabaseProfile(
        data.session.user.id,
        data.session.user.email,
      );
      const createdSession = createSession(createdUser, data.session.access_token);
      persistSession(createdSession);
      return createdSession;
    }

    throw new Error("Production authentication is not configured.");
  },
};
