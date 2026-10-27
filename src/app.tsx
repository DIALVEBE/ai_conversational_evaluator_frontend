import type { RealtimeMessage, RealtimeToken } from "@tanstack/ai";
import { openaiRealtime } from "@tanstack/ai-openai";
import { useRealtimeChat } from "@tanstack/ai-react";
import axios from "axios";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import academyImage from "./assets/virtualchallenge-collage.png";
import sessionImage from "./assets/virtualchallenge-session.png";
import tutorImage from "./assets/virtualchallenge-tutor.png";
import { apiBaseUrl, authClient } from "./lib/auth-client";

type AppRole = "admin" | "docente" | "estudiante";
type AdminSection = "usuarios" | "programas" | "espacios" | "asignaciones" | "historico";
type PageMetadata = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

const ADMIN_PAGE_SIZE = 25;
const EMPTY_PAGE: PageMetadata = { page: 1, pageSize: ADMIN_PAGE_SIZE, totalItems: 0, totalPages: 1 };

type ProgramOption = { id: string; name: string };
type SearchOption = { id: string; label: string };
type AdminUserFilters = { search: string; role: string; active: string };
type AdminCatalogFilters = { search: string; active: string };
type AdminSpaceFilters = AdminCatalogFilters & { programId: string };
type AdminAssignmentFilters = { search: string; programId: string; spaceId: string; relation: string };

function EyeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m3 3 18 18M10.6 6.2A10.8 10.8 0 0 1 12 6c6.1 0 9.5 6 9.5 6a15 15 0 0 1-3.1 3.7M6.2 6.3C3.8 8 2.5 12 2.5 12s3.4 6 9.5 6a10 10 0 0 0 3.1-.5" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

type AppUser = {
  id: string;
  name: string;
  email: string;
  profile: {
    role: AppRole;
    documentNumber: string | null;
    institutionalCode: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
  } | null;
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AppRole | null;
  documentNumber: string | null;
  institutionalCode: string | null;
  isActive: boolean;
};

type AcademicProgram = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

type AcademicSpace = {
  id: string;
  programId: string;
  programName: string;
  code: string;
  name: string;
  description: string | null;
  credits: number | null;
  semester: number | null;
  isActive: boolean;
};

type AdminSummary = {
  users: number;
  programs: number;
  spaces: number;
  assignments: number;
};

type AdminAssignment = {
  id: string;
  scope: "program" | "academic_space";
  relation: "student" | "teacher";
  targetId: string;
  targetName: string;
  userId: string;
  userName: string;
  userEmail: string;
};

type AdminResultAttempt = {
  id: string;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  teacherUserId: string;
  teacherName: string;
  programId: string;
  programName: string;
  academicSpaceId: string;
  academicSpaceName: string;
  liveTalkId: string;
  liveTalkTitle: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  finalScore: number | null;
  evaluationStatus: "completed" | "failed" | null;
  evaluationError: string | null;
  evaluationId: string | null;
  teacherReviewed: boolean;
  teacherOverrideGrade: number | null;
};

type AdminResultMetrics = {
  totalAttempts: number;
  completedAttempts: number;
  inProgressAttempts: number;
  cancelledAttempts: number;
  evaluatedAttempts: number;
  reviewedAttempts: number;
  overrideAttempts: number;
  averageScore: number | null;
  byProgram: Array<{
    id: string;
    name: string;
    attemptsCount: number;
    averageScore: number | null;
  }>;
  bySpace: Array<{
    id: string;
    name: string;
    attemptsCount: number;
    averageScore: number | null;
  }>;
};

type ConfirmationState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
} | null;

type TeacherAcademicSpace = {
  id: string;
  code: string;
  name: string;
  programId: string;
  programName: string;
  studentsCount: number;
};

type LiveTalkStatus = "draft" | "active" | "closed";

type TeacherLiveTalk = {
  id: string;
  academicSpaceId: string;
  academicSpaceName: string;
  title: string;
  generalTopic: string;
  status: LiveTalkStatus;
  opensAt: string | null;
  closesAt: string | null;
  createdAt: string;
  topics: string[];
};

type TeacherResultAttempt = {
  id: string;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  finalScore: number | null;
  evaluationStatus: "completed" | "failed" | null;
  evaluationError: string | null;
  evaluationId: string | null;
  teacherReviewed: boolean;
  teacherOverrideGrade: number | null;
};

type StudentLiveTalk = {
  id: string;
  academicSpaceId: string;
  academicSpaceName: string;
  programName: string;
  title: string;
  generalTopic: string;
  status: "active";
  opensAt: string | null;
  closesAt: string | null;
  topics: string[];
};

type StudentAttempt = {
  id: string;
  liveTalkId: string;
  liveTalkTitle: string;
  academicSpaceName: string;
  programName: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  finalScore: number | null;
  evaluationStatus: "completed" | "failed" | null;
  evaluationError: string | null;
  feedbackSummary: string | null;
};

type StudentAttemptDetail = StudentAttempt & {
  generalTopic: string;
  evaluationId: string | null;
  rubricVersion: string | null;
  evaluatorModel: string | null;
  evaluatorModelVersion: string | null;
  teacherReviewed: boolean;
  teacherOverrideGrade: number | null;
  teacherOverrideReason: string | null;
  feedback: {
    summary: string;
    strengths: string | null;
    improvementOpportunities: string | null;
    recommendations: string | null;
  } | null;
  rubricItems: Array<{
    id: string;
    topic: string | null;
    score: number;
    maxScore: number;
    performanceLevel: string;
    evidence: Array<{
      turn_id: number;
      fragment: string;
    }>;
    justification: string;
  }>;
  transcript: Array<{
    turnId: number;
    speaker: "student" | "evaluator";
    text: string;
    occurredAt: string | null;
    sourceMessageId: string | null;
  }>;
};

type TeacherAttemptDetail = {
  id: string;
  studentUserId: string;
  studentName: string;
  studentEmail: string;
  liveTalkId: string;
  liveTalkTitle: string;
  generalTopic: string;
  academicSpaceName: string;
  programName: string;
  status: "in_progress" | "completed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  finalScore: number | null;
  evaluationStatus: "completed" | "failed" | null;
  evaluationError: string | null;
  evaluationId: string | null;
  rubricVersion: string | null;
  evaluatorModel: string | null;
  evaluatorModelVersion: string | null;
  teacherReviewed: boolean;
  teacherOverrideGrade: number | null;
  teacherOverrideReason: string | null;
  feedback: {
    summary: string;
    strengths: string | null;
    improvementOpportunities: string | null;
    recommendations: string | null;
  } | null;
  rubricItems: StudentAttemptDetail["rubricItems"];
  transcript: StudentAttemptDetail["transcript"];
};

type AdminAttemptDetail = AdminResultAttempt & {
  generalTopic: string;
  rubricVersion: string | null;
  evaluatorModel: string | null;
  evaluatorModelVersion: string | null;
  teacherOverrideReason: string | null;
  feedback: {
    summary: string;
    strengths: string | null;
    improvementOpportunities: string | null;
    recommendations: string | null;
  } | null;
  rubricItems: StudentAttemptDetail["rubricItems"];
  transcript: StudentAttemptDetail["transcript"];
};

type ConversationToken = RealtimeToken & {
  attemptId: string;
};

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

const realtimeAdapter = openaiRealtime();
const institutionalLine = "Ingeniería de Sistemas - Harrizon Alexander Soler Galindo - Diego Alejandro Vela Beltrán - Campus Virtual 2026 - Santoto Tunja - Virtual Challenge";

export function App() {
  const session = authClient.useSession();
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [profileError, setProfileError] = useState<string>("");

  useEffect(() => {
    if (!session.data) {
      setAppUser(null);
      return;
    }

    let isMounted = true;

    api.get<{ user: AppUser }>("/me")
      .then((response) => {
        if (isMounted) {
          setAppUser(response.data.user);
          setProfileError("");
        }
      })
      .catch(() => {
        if (isMounted) {
          setAppUser(null);
          setProfileError("No fue posible cargar el perfil de la aplicación.");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [session.data]);

  if (session.isPending) {
    return (
      <main className="shell">
        <InstitutionalStrip />
        <p>Cargando sesión...</p>
        <AppFooter />
      </main>
    );
  }

  if (!session.data) {
    return <LoginScreen onSignedIn={session.refetch} />;
  }

  if (profileError) {
    return (
      <main className="shell">
        <InstitutionalStrip />
        <SessionHeader user={appUser} onSignOut={session.refetch} />
        <section className="panel">
          <h1>Perfil no disponible</h1>
          <p>{profileError}</p>
        </section>
        <AppFooter />
      </main>
    );
  }

  if (appUser?.profile?.mustChangePassword) {
    return (
      <main className="shell">
        <InstitutionalStrip />
        <SessionHeader user={appUser} onSignOut={session.refetch} />
        <InitialPasswordScreen
          email={appUser.email}
          onComplete={async () => {
            await authClient.signOut();
            await session.refetch();
            setAppUser(null);
          }}
        />
        <AppFooter />
      </main>
    );
  }

  return (
    <main className="shell">
      <InstitutionalStrip />
      <SessionHeader user={appUser} onSignOut={session.refetch} />
      <RoleHome user={appUser} />
      <AppFooter />
    </main>
  );
}

function LoginScreen(props: {
  onSignedIn: () => Promise<unknown> | unknown;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe: true,
      });

      if (result.error) {
        setError(result.error.message ?? "No fue posible iniciar sesión.");
      } else {
        await props.onSignedIn();
      }
    } catch {
      setError("No fue posible iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <InstitutionalStrip />
      <section className="login-shell">
        <div className="login-visual">
          <img src={tutorImage} alt="" />
          <div className="login-visual-copy">
            <p className="eyebrow">VirtualChallenge</p>
            <h1>Evaluación oral asistida</h1>
            <p>
              Autenticación por rol, live talks activos, evidencia auditable y revisión
              académica en un mismo flujo.
            </p>
          </div>
        </div>

        <div className="login-panel">
          <div>
            <p className="eyebrow">Ingreso institucional</p>
            <h2>Acceso a plataforma</h2>
          </div>

          <form className="form-stack" onSubmit={onSubmit}>
            <label>
              Correo
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@institucion.edu.co"
                type="email"
                autoComplete="email"
                required
              />
            </label>

            <label>
              Contraseña
              <span className="password-field">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="password-visibility"
                  onClick={() => setShowPassword((visible) => !visible)}
                  title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  type="button"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </span>
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

        </div>
      </section>
      <AppFooter />
    </main>
  );
}

function InitialPasswordScreen(props: {
  email: string;
  onComplete: () => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post("/me/initial-password", { currentPassword, newPassword });
      setSuccess(true);
      window.setTimeout(() => {
        void props.onComplete().catch(() => {
          setError("La contraseña se actualizó, pero no fue posible cerrar la sesión. Sal e ingresa nuevamente.");
        });
      }, 1400);
    } catch {
      setError("No fue posible actualizar la contraseña. Verifica la contraseña temporal e inténtalo de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel initial-password-panel">
      <p className="eyebrow">Primer ingreso</p>
      <h1>Actualiza tu contraseña</h1>
      <p className="muted">
        Tu número de documento es la contraseña temporal. Reemplázala ahora por una
        contraseña nueva de al menos 12 caracteres antes de continuar.
      </p>
      <p className="password-account">
        Cuenta autenticada: <strong>{props.email}</strong>
      </p>
      <form className="form-stack" autoComplete="off" onSubmit={onSubmit}>
        <label>
          Contraseña temporal
          <span className="password-field">
            <input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="off"
              required
            />
            <button
              aria-label={showCurrentPassword ? "Ocultar contraseña temporal" : "Mostrar contraseña temporal"}
              className="password-visibility"
              onClick={() => setShowCurrentPassword((visible) => !visible)}
              title={showCurrentPassword ? "Ocultar contraseña temporal" : "Mostrar contraseña temporal"}
              type="button"
            >
              {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>
        <label>
          Nueva contraseña
          <span className="password-field">
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
            <button
              aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
              className="password-visibility"
              onClick={() => setShowNewPassword((visible) => !visible)}
              title={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
              type="button"
            >
              {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>
        <label>
          Confirmar nueva contraseña
          <span className="password-field">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
            <button
              aria-label={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
              className="password-visibility"
              onClick={() => setShowConfirmPassword((visible) => !visible)}
              title={showConfirmPassword ? "Ocultar confirmación" : "Mostrar confirmación"}
              type="button"
            >
              {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </span>
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        {success ? (
          <p className="success-text" role="status">
            Contraseña actualizada. Te redirigiremos al inicio de sesión.
          </p>
        ) : null}
        <button type="submit" disabled={isSubmitting || success}>
          {isSubmitting ? "Actualizando..." : success ? "Actualizada" : "Guardar contraseña"}
        </button>
      </form>
    </section>
  );
}

function InstitutionalStrip() {
  return <div className="institutional-strip">{institutionalLine}</div>;
}

function AppFooter() {
  return <footer className="app-footer">{institutionalLine}</footer>;
}

function SessionHeader(props: {
  user: AppUser | null;
  onSignOut: () => void;
}) {
  async function signOut() {
    await authClient.signOut();
    props.onSignOut();
  }

  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">VirtualChallenge</p>
        <strong>{props.user?.name ?? "Usuario autenticado"}</strong>
      </div>
      <div className="topbar-actions">
        <span>{props.user?.profile?.role ?? "Sin perfil"}</span>
        <button type="button" onClick={signOut}>Salir</button>
      </div>
    </header>
  );
}

function RoleHome(props: {
  user: AppUser | null;
}) {
  const role = props.user?.profile?.role;

  if (role === "admin") {
    return <AdminHome user={props.user} />;
  }

  if (role === "docente") {
    return <TeacherHome user={props.user} />;
  }

  if (role === "estudiante") {
    return <StudentHome user={props.user} />;
  }

  return (
    <section className="panel empty-state">
      <p className="eyebrow">Perfil pendiente</p>
      <h1>Usuario sin rol activo</h1>
      <p className="muted">El usuario inició sesión, pero aún no tiene perfil de aplicación.</p>
    </section>
  );
}

function AdminHome(props: {
  user: AppUser | null;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("usuarios");
  const [summary, setSummary] = useState<AdminSummary>({
    users: 0,
    programs: 0,
    spaces: 0,
    assignments: 0,
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersPagination, setUsersPagination] = useState(EMPTY_PAGE);
  const [usersPage, setUsersPage] = useState(1);
  const [userFilters, setUserFilters] = useState<AdminUserFilters>({ search: "", role: "", active: "" });
  const [programs, setPrograms] = useState<AcademicProgram[]>([]);
  const [programsPagination, setProgramsPagination] = useState(EMPTY_PAGE);
  const [programsPage, setProgramsPage] = useState(1);
  const [programFilters, setProgramFilters] = useState<AdminCatalogFilters>({ search: "", active: "" });
  const [academicSpaces, setAcademicSpaces] = useState<AcademicSpace[]>([]);
  const [programOptions, setProgramOptions] = useState<ProgramOption[]>([]);
  const [spacesPagination, setSpacesPagination] = useState(EMPTY_PAGE);
  const [spacesPage, setSpacesPage] = useState(1);
  const [spaceFilters, setSpaceFilters] = useState<AdminSpaceFilters>({ search: "", active: "", programId: "" });
  const [programAssignments, setProgramAssignments] = useState<AdminAssignment[]>([]);
  const [programAssignmentsPagination, setProgramAssignmentsPagination] = useState(EMPTY_PAGE);
  const [programAssignmentsPage, setProgramAssignmentsPage] = useState(1);
  const [programAssignmentFilters, setProgramAssignmentFilters] = useState<AdminAssignmentFilters>({ search: "", programId: "", spaceId: "", relation: "" });
  const [spaceAssignments, setSpaceAssignments] = useState<AdminAssignment[]>([]);
  const [spaceAssignmentsPagination, setSpaceAssignmentsPagination] = useState(EMPTY_PAGE);
  const [spaceAssignmentsPage, setSpaceAssignmentsPage] = useState(1);
  const [spaceAssignmentFilters, setSpaceAssignmentFilters] = useState<AdminAssignmentFilters>({ search: "", programId: "", spaceId: "", relation: "" });
  const [adminError, setAdminError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadedSections, setLoadedSections] = useState<Set<AdminSection>>(() => new Set());
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);

  function showError(message: string) {
    setAdminError(message);
  }

  const loadAdminData = useCallback(async () => {
    setAdminError("");
    setIsLoading(true);

    try {
      const summaryResponse = await api.get<{ summary: AdminSummary }>("/admin/summary");
      setSummary(summaryResponse.data.summary);

      if (activeSection === "usuarios") {
        const response = await api.get<{ users: AdminUser[]; pagination: PageMetadata }>(
          "/admin/users",
          { params: { ...userFilters, page: usersPage, pageSize: ADMIN_PAGE_SIZE } },
        );
        setUsers(response.data.users);
        setUsersPagination(response.data.pagination);
        setUsersPage(response.data.pagination.page);
      } else if (activeSection === "programas") {
        const response = await api.get<{ programs: AcademicProgram[]; pagination: PageMetadata }>(
          "/admin/programs",
          { params: { ...programFilters, page: programsPage, pageSize: ADMIN_PAGE_SIZE } },
        );
        setPrograms(response.data.programs);
        setProgramsPagination(response.data.pagination);
        setProgramsPage(response.data.pagination.page);
      } else if (activeSection === "espacios") {
        const [spacesResponse, programsResponse] = await Promise.all([
          api.get<{ academicSpaces: AcademicSpace[]; pagination: PageMetadata }>(
            "/admin/academic-spaces",
            { params: { ...spaceFilters, page: spacesPage, pageSize: ADMIN_PAGE_SIZE } },
          ),
          api.get<{ programs: ProgramOption[] }>("/admin/programs/options"),
        ]);
        setAcademicSpaces(spacesResponse.data.academicSpaces);
        setSpacesPagination(spacesResponse.data.pagination);
        setSpacesPage(spacesResponse.data.pagination.page);
        setProgramOptions(programsResponse.data.programs);
      } else if (activeSection === "asignaciones") {
        const [programResponse, spaceResponse, programsResponse] = await Promise.all([
          api.get<{ assignments: AdminAssignment[]; pagination: PageMetadata }>(
            "/admin/assignments",
            { params: { scope: "program", ...programAssignmentFilters, page: programAssignmentsPage, pageSize: ADMIN_PAGE_SIZE } },
          ),
          api.get<{ assignments: AdminAssignment[]; pagination: PageMetadata }>(
            "/admin/assignments",
            { params: { scope: "academic_space", ...spaceAssignmentFilters, page: spaceAssignmentsPage, pageSize: ADMIN_PAGE_SIZE } },
          ),
          api.get<{ programs: ProgramOption[] }>("/admin/programs/options"),
        ]);
        setProgramAssignments(programResponse.data.assignments);
        setProgramAssignmentsPagination(programResponse.data.pagination);
        setProgramAssignmentsPage(programResponse.data.pagination.page);
        setSpaceAssignments(spaceResponse.data.assignments);
        setSpaceAssignmentsPagination(spaceResponse.data.pagination);
        setSpaceAssignmentsPage(spaceResponse.data.pagination.page);
        setProgramOptions(programsResponse.data.programs);
      }
      setLoadedSections((current) => new Set(current).add(activeSection));
    } catch {
      setAdminError("No fue posible cargar la información administrativa.");
    } finally {
      setIsLoading(false);
    }
  }, [activeSection, usersPage, programsPage, spacesPage, programAssignmentsPage, spaceAssignmentsPage, userFilters, programFilters, spaceFilters, programAssignmentFilters, spaceAssignmentFilters]);

  useEffect(() => {
    void loadAdminData();
    const refreshTimer = window.setInterval(() => {
      if (activeSection !== "historico") void loadAdminData();
    }, 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [loadAdminData, activeSection]);

  const adminSteps: Array<{
    id: typeof activeSection;
    number: string;
    label: string;
    summary: string;
    description: string;
  }> = [
    {
      id: "usuarios",
      number: "01",
      label: "Usuarios",
      summary: `${summary.users} perfiles`,
      description: "Crea y activa cuentas por rol.",
    },
    {
      id: "programas",
      number: "02",
      label: "Programas",
      summary: `${summary.programs} programas`,
      description: "Define la estructura académica base.",
    },
    {
      id: "espacios",
      number: "03",
      label: "Espacios",
      summary: `${summary.spaces} espacios`,
      description: "Conecta materias con programas.",
    },
    {
      id: "asignaciones",
      number: "04",
      label: "Asignaciones",
      summary: `${summary.assignments} vínculos`,
      description: "Relaciona docentes y estudiantes.",
    },
    {
      id: "historico",
      number: "05",
      label: "Histórico",
      summary: "Notas y evidencia",
      description: "Consulta resultados auditables.",
    },
  ];
  const activeStep = adminSteps.find((step) => step.id === activeSection) ?? adminSteps[0];

  return (
    <section className="role-workspace admin-workspace">
      <section className="workspace-hero admin-control-hero">
        <div className="hero-copy">
          <p className="eyebrow">Administración</p>
          <h1>Centro de configuración académica</h1>
          <p>
            Ordena la operación desde la base institucional hasta la evidencia de cada
            evaluación.
          </p>
        </div>
        <div className="hero-media">
          <img src={academyImage} alt="" />
        </div>
        <div className="hero-badge">
          <span>Rol activo</span>
          <strong>{props.user?.profile?.role ?? "admin"}</strong>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard label="Usuarios" value={String(summary.users)} detail="Perfiles registrados" />
        <MetricCard label="Programas" value={String(summary.programs)} detail="Programas activos o inactivos" />
        <MetricCard label="Espacios" value={String(summary.spaces)} detail="Espacios académicos" />
        <MetricCard label="Asignaciones" value={String(summary.assignments)} detail="Vínculos académicos" />
      </section>

      <nav className="workflow-steps" aria-label="Flujo administrativo">
        {adminSteps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`workflow-step ${activeSection === step.id ? "active" : ""}`}
            onClick={() => setActiveSection(step.id)}
          >
            <span>{step.number}</span>
            <strong>{step.label}</strong>
            <em>{step.summary}</em>
            <small>{step.description}</small>
          </button>
        ))}
      </nav>

      <section className="active-workflow-heading">
        <div>
          <p className="eyebrow">{activeStep.number} · {activeStep.label}</p>
          <h2>{activeStep.description}</h2>
        </div>
      </section>

      {adminError ? <p className="error-text">{adminError}</p> : null}
      {isLoading && !loadedSections.has(activeSection) ? <section className="panel"><p>Cargando sección...</p></section> : null}
      {loadedSections.has(activeSection) && activeSection === "usuarios" ? (
        <AdminUsersPanel
          users={users}
          pagination={usersPagination}
          isLoading={isLoading}
          onPageChange={setUsersPage}
          filters={userFilters}
          onFilter={(filters) => { setUserFilters(filters); setUsersPage(1); }}
          currentUserId={props.user?.id ?? ""}
          onChanged={loadAdminData}
          confirm={setConfirmation}
          showError={showError}
        />
      ) : null}
      {loadedSections.has(activeSection) && activeSection === "programas" ? (
        <AdminProgramsPanel
          programs={programs}
          pagination={programsPagination}
          isLoading={isLoading}
          onPageChange={setProgramsPage}
          filters={programFilters}
          onFilter={(filters) => { setProgramFilters(filters); setProgramsPage(1); }}
          onChanged={loadAdminData}
          confirm={setConfirmation}
          showError={showError}
        />
      ) : null}
      {loadedSections.has(activeSection) && activeSection === "espacios" ? (
        <AdminSpacesPanel
          academicSpaces={academicSpaces}
          programs={programOptions}
          pagination={spacesPagination}
          isLoading={isLoading}
          onPageChange={setSpacesPage}
          filters={spaceFilters}
          onFilter={(filters) => { setSpaceFilters(filters); setSpacesPage(1); }}
          onChanged={loadAdminData}
          confirm={setConfirmation}
          showError={showError}
        />
      ) : null}
      {loadedSections.has(activeSection) && activeSection === "asignaciones" ? (
        <AdminAssignmentsPanel
          programAssignments={programAssignments}
          programPagination={programAssignmentsPagination}
          onProgramPageChange={setProgramAssignmentsPage}
          spaceAssignments={spaceAssignments}
          spacePagination={spaceAssignmentsPagination}
          onSpacePageChange={setSpaceAssignmentsPage}
          programOptions={programOptions}
          programFilters={programAssignmentFilters}
          onProgramFilter={(filters) => { setProgramAssignmentFilters(filters); setProgramAssignmentsPage(1); }}
          spaceFilters={spaceAssignmentFilters}
          onSpaceFilter={(filters) => { setSpaceAssignmentFilters(filters); setSpaceAssignmentsPage(1); }}
          isLoading={isLoading}
          onChanged={loadAdminData}
          confirm={setConfirmation}
          showError={showError}
        />
      ) : null}
      {activeSection === "historico" ? (
        <AdminResultsPanel />
      ) : null}

      {confirmation ? (
        <ConfirmDialog
          confirmation={confirmation}
          onClose={() => setConfirmation(null)}
        />
      ) : null}
    </section>
  );
}

function AdminUsersPanel(props: {
  users: AdminUser[];
  pagination: PageMetadata;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  filters: AdminUserFilters;
  onFilter: (filters: AdminUserFilters) => void;
  currentUserId: string;
  onChanged: () => Promise<void>;
  confirm: (confirmation: ConfirmationState) => void;
  showError: (message: string) => void;
}) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "Demo2026!",
    role: "estudiante" as AppRole,
    documentNumber: "",
    institutionalCode: "",
  });
  const [error, setError] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState<{
    email: string;
    temporaryPassword: string;
  } | null>(null);
  const [credentialCopied, setCredentialCopied] = useState(false);
  const [credentialCopyError, setCredentialCopyError] = useState("");
  const [filterDraft, setFilterDraft] = useState(props.filters);
  useAutoAdminFilter(filterDraft, props.onFilter, filterDraft.search);

  function resetForm() {
    setEditingUserId(null);
    setIsFormOpen(false);
    setError("");
    setForm({
      name: "",
      email: "",
      password: "Demo2026!",
      role: "estudiante",
      documentNumber: "",
      institutionalCode: "",
    });
  }

  function editUser(user: AdminUser) {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      password: "Demo2026!",
      role: user.role ?? "estudiante",
      documentNumber: user.documentNumber ?? "",
      institutionalCode: user.institutionalCode ?? "",
    });
    setIsFormOpen(true);
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      if (editingUserId) {
        const existingUser = props.users.find((user) => user.id === editingUserId);
        await api.patch(`/admin/users/${editingUserId}`, {
          name: form.name,
          role: form.role,
          documentNumber: form.documentNumber,
          institutionalCode: form.institutionalCode,
          isActive: existingUser?.isActive ?? true,
        });
      } else {
        await api.post("/admin/users", form);
      }

      resetForm();
      await props.onChanged();
    } catch {
      setError("No fue posible guardar el usuario. Revisa correo, documento o código.");
    }
  }

  async function toggleUser(user: AdminUser) {
    props.confirm({
      title: user.isActive ? "Desactivar usuario" : "Activar usuario",
      message: `${user.name} quedará ${user.isActive ? "inactivo" : "activo"} en la plataforma.`,
      confirmLabel: user.isActive ? "Desactivar" : "Activar",
      onConfirm: async () => {
        await api.patch(`/admin/users/${user.id}`, {
          name: user.name,
          role: user.role ?? "estudiante",
          documentNumber: user.documentNumber ?? "",
          institutionalCode: user.institutionalCode ?? "",
          isActive: !user.isActive,
        });
        await props.onChanged();
      },
    });
  }

  function resetPassword(user: AdminUser) {
    props.confirm({
      title: "Restablecer contraseña",
      message: `Se generará una clave temporal para ${user.name}. Su contraseña actual dejará de funcionar y se cerrarán sus sesiones.`,
      confirmLabel: "Generar clave temporal",
      onConfirm: async () => {
        const response = await api.post<{
          email: string;
          temporaryPassword: string;
        }>(`/admin/users/${user.id}/reset-password`);
        setCredentialCopied(false);
        setCredentialCopyError("");
        setTemporaryCredential(response.data);
      },
    });
  }

  async function copyTemporaryPassword() {
    if (!temporaryCredential) return;
    try {
      await navigator.clipboard.writeText(temporaryCredential.temporaryPassword);
      setCredentialCopied(true);
      setCredentialCopyError("");
    } catch {
      setCredentialCopyError("No se pudo copiar automáticamente. Selecciona la clave y cópiala manualmente.");
    }
  }

  return (
    <section className="admin-grid admin-table-workspace">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Usuarios</p>
            <h2>Gestión de usuarios</h2>
          </div>
          <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }}>Crear usuario</button>
        </div>
        <div className="admin-filter-bar">
          <label className="filter-search-field">
            Búsqueda inteligente
            <input value={filterDraft.search} onChange={(event) => setFilterDraft({ ...filterDraft, search: event.target.value })} placeholder="Nombre, cédula o correo" />
          </label>
          <label>Rol
            <select value={filterDraft.role} onChange={(event) => { const next = { ...filterDraft, role: event.target.value }; setFilterDraft(next); props.onFilter(next); }}>
              <option value="">Todos</option><option value="admin">Administrador</option><option value="docente">Docente</option><option value="estudiante">Estudiante</option>
            </select>
          </label>
          <label>Estado
            <select value={filterDraft.active} onChange={(event) => { const next = { ...filterDraft, active: event.target.value }; setFilterDraft(next); props.onFilter(next); }}>
              <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select>
          </label>
          <FilterActions onClear={() => { const cleared = { search: "", role: "", active: "" }; setFilterDraft(cleared); props.onFilter(cleared); }} />
        </div>
        <DataTable
          rows={props.users}
          emptyMessage="No hay usuarios registrados."
          columns={[
            { label: "Nombre", render: (user) => user.name },
            { label: "Correo", render: (user) => user.email },
            { label: "Rol", render: (user) => user.role ?? "Sin rol" },
            { label: "Estado", render: (user) => <StatusPill active={user.isActive} /> },
          ]}
          actions={(user) => [
            { label: "Editar", icon: "edit", onClick: () => editUser(user) },
            ...(user.isActive && user.id !== props.currentUserId ? [{ label: "Restablecer contraseña", icon: "key" as const, onClick: () => resetPassword(user) }] : []),
            { label: user.isActive ? "Desactivar" : "Activar", icon: user.isActive ? "disable" : "enable", onClick: () => void toggleUser(user) },
          ]}
          pagination={props.pagination}
          isLoading={props.isLoading}
          onPageChange={props.onPageChange}
        />
      </div>

      {temporaryCredential ? (
        <ModalDialog
          title="Clave temporal generada"
          onClose={() => setTemporaryCredential(null)}
        >
          <div className="form-stack">
            <p className="muted">Cuenta: <strong>{temporaryCredential.email}</strong></p>
            <label>
              Contraseña temporal
              <span className="password-field">
                <input readOnly value={temporaryCredential.temporaryPassword} />
                <button
                  aria-label={credentialCopied ? "Contraseña copiada" : "Copiar contraseña"}
                  className="password-visibility"
                  onClick={() => void copyTemporaryPassword()}
                  title={credentialCopied ? "Contraseña copiada" : "Copiar contraseña"}
                  type="button"
                >
                  <ActionIcon name="copy" />
                </button>
              </span>
            </label>
            <p className="success-text" role="status">
              Entrégala al usuario por un canal verificado. Solo se mostrará en esta ventana.
            </p>
            {credentialCopied ? <p className="success-text" role="status">Clave copiada.</p> : null}
            {credentialCopyError ? <p className="error-text" role="alert">{credentialCopyError}</p> : null}
            <p className="muted">
              El usuario deberá crear una contraseña nueva al ingresar. La clave temporal no se podrá volver a consultar.
            </p>
          </div>
        </ModalDialog>
      ) : null}

      {isFormOpen ? <ModalDialog title={editingUserId ? "Editar usuario" : "Crear usuario"} onClose={resetForm}>
        <form className="form-stack" onSubmit={saveUser}>
          <label>
            Nombre
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Correo
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required disabled={Boolean(editingUserId)} />
          </label>
          {!editingUserId ? (
            <label>
              Contraseña inicial
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required />
            </label>
          ) : null}
          <label>
            Rol
            <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AppRole })}>
              <option value="admin">Administrador</option>
              <option value="docente">Docente</option>
              <option value="estudiante">Estudiante</option>
            </select>
          </label>
          <label>
            Documento
            <input value={form.documentNumber} onChange={(event) => setForm({ ...form, documentNumber: event.target.value })} />
          </label>
          <label>
            Código institucional
            <input value={form.institutionalCode} onChange={(event) => setForm({ ...form, institutionalCode: event.target.value })} />
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="inline-form">
            <button type="submit">{editingUserId ? "Guardar usuario" : "Crear usuario"}</button>
            {editingUserId ? <button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button> : null}
          </div>
        </form>
      </ModalDialog> : null}
    </section>
  );
}

function AdminProgramsPanel(props: {
  programs: AcademicProgram[];
  pagination: PageMetadata;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  filters: AdminCatalogFilters;
  onFilter: (filters: AdminCatalogFilters) => void;
  onChanged: () => Promise<void>;
  confirm: (confirmation: ConfirmationState) => void;
  showError: (message: string) => void;
}) {
  const [editingProgramId, setEditingProgramId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", description: "", isActive: true });
  const [error, setError] = useState("");
  const [filterDraft, setFilterDraft] = useState(props.filters);
  useAutoAdminFilter(filterDraft, props.onFilter, filterDraft.search);

  function resetForm() {
    setEditingProgramId(null);
    setIsFormOpen(false);
    setError("");
    setForm({ code: "", name: "", description: "", isActive: true });
  }

  function editProgram(program: AcademicProgram) {
    setEditingProgramId(program.id);
    setForm({
      code: program.code,
      name: program.name,
      description: program.description ?? "",
      isActive: program.isActive,
    });
    setIsFormOpen(true);
  }

  async function saveProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      if (editingProgramId) {
        await api.patch(`/admin/programs/${editingProgramId}`, form);
      } else {
        await api.post("/admin/programs", form);
      }

      resetForm();
      await props.onChanged();
    } catch {
      setError("No fue posible guardar el programa. Revisa si el código ya existe.");
    }
  }

  async function deleteProgram(programId: string) {
    const program = props.programs.find((item) => item.id === programId);

    props.confirm({
      title: "Eliminar programa",
      message: `Esta acción intentará eliminar ${program?.name ?? "el programa"}. Si tiene espacios o estudiantes asociados, el sistema lo bloqueará.`,
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/programs/${programId}`);
          await props.onChanged();
        } catch (error) {
          props.showError(getApiErrorMessage(error));
        }
      },
    });
  }

  return (
    <section className="admin-grid admin-table-workspace">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Programas</p>
            <h2>Programas académicos</h2>
          </div>
          <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }}>Crear programa</button>
        </div>
        <div className="admin-filter-bar">
          <label className="filter-search-field">Buscar programa
            <input value={filterDraft.search} onChange={(event) => setFilterDraft({ ...filterDraft, search: event.target.value })} placeholder="Nombre o código" />
          </label>
          <label>Estado
            <select value={filterDraft.active} onChange={(event) => { const next = { ...filterDraft, active: event.target.value }; setFilterDraft(next); props.onFilter(next); }}>
              <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select>
          </label>
          <FilterActions onClear={() => { const cleared = { search: "", active: "" }; setFilterDraft(cleared); props.onFilter(cleared); }} />
        </div>
        <DataTable
          rows={props.programs}
          emptyMessage="No hay programas registrados."
          columns={[
            { label: "Código", render: (program) => program.code },
            { label: "Nombre", render: (program) => program.name },
            { label: "Descripción", render: (program) => program.description || "Sin descripción" },
            { label: "Estado", render: (program) => <StatusPill active={program.isActive} /> },
          ]}
          actions={(program) => [
            { label: "Editar", icon: "edit", onClick: () => editProgram(program) },
            { label: "Eliminar", icon: "delete", onClick: () => void deleteProgram(program.id) },
          ]}
          pagination={props.pagination}
          isLoading={props.isLoading}
          onPageChange={props.onPageChange}
        />
      </div>

      {isFormOpen ? <ModalDialog title={editingProgramId ? "Editar programa" : "Crear programa"} onClose={resetForm}>
        <form className="form-stack" onSubmit={saveProgram}>
          <label>
            Código
            <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
          </label>
          <label>
            Nombre
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </label>
          <label>
            Descripción
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
            Programa activo
          </label>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="inline-form">
            <button type="submit">{editingProgramId ? "Guardar programa" : "Crear programa"}</button>
            {editingProgramId ? <button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button> : null}
          </div>
        </form>
      </ModalDialog> : null}
    </section>
  );
}

function AdminSpacesPanel(props: {
  academicSpaces: AcademicSpace[];
  programs: ProgramOption[];
  pagination: PageMetadata;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  filters: AdminSpaceFilters;
  onFilter: (filters: AdminSpaceFilters) => void;
  onChanged: () => Promise<void>;
  confirm: (confirmation: ConfirmationState) => void;
  showError: (message: string) => void;
}) {
  const firstProgramId = props.programs[0]?.id ?? "";
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [form, setForm] = useState({
    programId: firstProgramId,
    code: "",
    name: "",
    description: "",
    credits: "3",
    semester: "1",
    isActive: true,
  });
  const [assignment, setAssignment] = useState({
    spaceId: "",
    teacherUserId: "",
    studentUserId: "",
  });
  const [error, setError] = useState("");
  const [filterDraft, setFilterDraft] = useState(props.filters);
  useAutoAdminFilter(filterDraft, props.onFilter, filterDraft.search);

  useEffect(() => {
    if (!form.programId && firstProgramId) {
      setForm((current) => ({ ...current, programId: firstProgramId }));
    }
  }, [firstProgramId, form.programId]);

  function resetForm() {
    setEditingSpaceId(null);
    setIsFormOpen(false);
    setError("");
    setForm({
      programId: firstProgramId,
      code: "",
      name: "",
      description: "",
      credits: "3",
      semester: "1",
      isActive: true,
    });
  }

  function editSpace(space: AcademicSpace) {
    setEditingSpaceId(space.id);
    setForm({
      programId: space.programId,
      code: space.code,
      name: space.name,
      description: space.description ?? "",
      credits: String(space.credits ?? 0),
      semester: String(space.semester ?? 1),
      isActive: space.isActive,
    });
    setIsFormOpen(true);
  }

  async function saveSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const payload = {
        ...form,
        credits: Number(form.credits),
        semester: Number(form.semester),
      };

      if (editingSpaceId) {
        await api.patch(`/admin/academic-spaces/${editingSpaceId}`, payload);
      } else {
        await api.post("/admin/academic-spaces", payload);
      }

      resetForm();
      await props.onChanged();
    } catch {
      setError("No fue posible guardar el espacio académico.");
    }
  }

  async function deleteSpace(spaceId: string) {
    const space = props.academicSpaces.find((item) => item.id === spaceId);

    props.confirm({
      title: "Eliminar espacio académico",
      message: `Esta acción intentará eliminar ${space?.name ?? "el espacio académico"}. Si tiene usuarios, live talks o notas asociadas, el sistema lo bloqueará.`,
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        try {
          await api.delete(`/admin/academic-spaces/${spaceId}`);
          await props.onChanged();
        } catch (error) {
          props.showError(getApiErrorMessage(error));
        }
      },
    });
  }

  async function assignTeacher() {
    if (!assignment.spaceId || !assignment.teacherUserId) return;
    await api.post(`/admin/academic-spaces/${assignment.spaceId}/teachers`, {
      teacherUserId: assignment.teacherUserId,
    });
    await props.onChanged();
    setIsAssignmentOpen(false);
  }

  async function assignStudent() {
    if (!assignment.spaceId || !assignment.studentUserId) return;
    await api.post(`/admin/academic-spaces/${assignment.spaceId}/students`, {
      studentUserId: assignment.studentUserId,
    });
    await props.onChanged();
    setIsAssignmentOpen(false);
  }

  return (
    <section className="admin-grid admin-table-workspace">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Espacios</p>
            <h2>Espacios académicos</h2>
          </div>
          <div className="inline-form">
            <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }}>Crear espacio</button>
            <button type="button" className="secondary-button" onClick={() => setIsAssignmentOpen(true)}>Asignar usuario</button>
          </div>
        </div>
        <div className="admin-filter-bar">
          <label className="filter-search-field">Buscar espacio
            <input value={filterDraft.search} onChange={(event) => setFilterDraft({ ...filterDraft, search: event.target.value })} placeholder="Nombre o código" />
          </label>
          <label>Programa
            <select value={filterDraft.programId} onChange={(event) => { const next = { ...filterDraft, programId: event.target.value }; setFilterDraft(next); props.onFilter(next); }}>
              <option value="">Todos</option>{props.programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={filterDraft.active} onChange={(event) => { const next = { ...filterDraft, active: event.target.value }; setFilterDraft(next); props.onFilter(next); }}>
              <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select>
          </label>
          <FilterActions onClear={() => { const cleared = { search: "", active: "", programId: "" }; setFilterDraft(cleared); props.onFilter(cleared); }} />
        </div>
        <DataTable
          rows={props.academicSpaces}
          emptyMessage="No hay espacios académicos registrados."
          columns={[
            { label: "Código", render: (space) => space.code },
            { label: "Espacio académico", render: (space) => space.name },
            { label: "Programa", render: (space) => space.programName },
            { label: "Semestre", render: (space) => String(space.semester ?? "-") },
            { label: "Estado", render: (space) => <StatusPill active={space.isActive} /> },
          ]}
          actions={(space) => [
            { label: "Editar", icon: "edit", onClick: () => editSpace(space) },
            { label: "Eliminar", icon: "delete", onClick: () => void deleteSpace(space.id) },
          ]}
          pagination={props.pagination}
          isLoading={props.isLoading}
          onPageChange={props.onPageChange}
        />
      </div>

      {isFormOpen ? <ModalDialog title={editingSpaceId ? "Editar espacio" : "Crear espacio"} onClose={resetForm}>
          <form className="form-stack" onSubmit={saveSpace}>
            <label>
              Programa
              <select value={form.programId} onChange={(event) => setForm({ ...form, programId: event.target.value })} required>
                {props.programs.map((program) => (
                  <option key={program.id} value={program.id}>{program.name}</option>
                ))}
              </select>
            </label>
            <label>
              Código
              <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required />
            </label>
            <label>
              Nombre
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <div className="two-column-form">
              <label>
                Créditos
                <input type="number" value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} />
              </label>
              <label>
                Semestre
                <input type="number" value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} />
              </label>
            </div>
            <label>
              Descripción
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
              Espacio activo
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <div className="inline-form">
              <button type="submit" disabled={props.programs.length === 0}>
                {editingSpaceId ? "Guardar espacio" : "Crear espacio"}
              </button>
              {editingSpaceId ? <button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button> : null}
            </div>
          </form>
      </ModalDialog> : null}

      {isAssignmentOpen ? <ModalDialog title="Vincular usuarios al espacio" onClose={() => setIsAssignmentOpen(false)}>
          <div className="section-heading">
            <div>
              <p className="eyebrow">Asignaciones</p>
              <h2>Vincular usuarios</h2>
            </div>
          </div>
          <div className="form-stack">
            <AdminSpacePicker
              value={assignment.spaceId}
              onChange={(spaceId) => setAssignment((current) => ({ ...current, spaceId }))}
            />
            <div className="inline-form">
              <AdminUserPicker
                role="docente"
                value={assignment.teacherUserId}
                onChange={(teacherUserId) => setAssignment((current) => ({ ...current, teacherUserId }))}
              />
              <button type="button" onClick={() => void assignTeacher()}>Asignar</button>
            </div>
            <div className="inline-form">
              <AdminUserPicker
                role="estudiante"
                value={assignment.studentUserId}
                onChange={(studentUserId) => setAssignment((current) => ({ ...current, studentUserId }))}
              />
              <button type="button" onClick={() => void assignStudent()}>Asignar</button>
            </div>
          </div>
      </ModalDialog> : null}
    </section>
  );
}

function AdminAssignmentsPanel(props: {
  programAssignments: AdminAssignment[];
  programPagination: PageMetadata;
  onProgramPageChange: (page: number) => void;
  spaceAssignments: AdminAssignment[];
  spacePagination: PageMetadata;
  onSpacePageChange: (page: number) => void;
  programOptions: ProgramOption[];
  programFilters: AdminAssignmentFilters;
  onProgramFilter: (filters: AdminAssignmentFilters) => void;
  spaceFilters: AdminAssignmentFilters;
  onSpaceFilter: (filters: AdminAssignmentFilters) => void;
  isLoading: boolean;
  onChanged: () => Promise<void>;
  confirm: (confirmation: ConfirmationState) => void;
  showError: (message: string) => void;
}) {
  const [programDraft, setProgramDraft] = useState(props.programFilters);
  const [spaceDraft, setSpaceDraft] = useState(props.spaceFilters);
  useAutoAdminFilter(programDraft, props.onProgramFilter, programDraft.search);
  useAutoAdminFilter(spaceDraft, props.onSpaceFilter, spaceDraft.search);

  async function removeAssignment(assignment: AdminAssignment) {
    props.confirm({
      title: "Desasignar usuario",
      message: `${assignment.userName} será removido de ${assignment.targetName}.`,
      confirmLabel: "Desasignar",
      onConfirm: async () => {
        try {
          if (assignment.scope === "program" && assignment.relation === "student") {
            await api.delete(`/admin/programs/${assignment.targetId}/students/${assignment.userId}`);
          }

          if (assignment.scope === "academic_space" && assignment.relation === "teacher") {
            await api.delete(`/admin/academic-spaces/${assignment.targetId}/teachers/${assignment.userId}`);
          }

          if (assignment.scope === "academic_space" && assignment.relation === "student") {
            await api.delete(`/admin/academic-spaces/${assignment.targetId}/students/${assignment.userId}`);
          }

          await props.onChanged();
        } catch (error) {
          props.showError(getApiErrorMessage(error));
        }
      },
    });
  }

  return (
    <section className="admin-grid admin-assignment-grid">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Programas</p>
            <h2>Estudiantes por programa</h2>
          </div>
        </div>
        <div className="admin-filter-bar">
          <label className="filter-search-field">Buscar estudiante
            <input value={programDraft.search} onChange={(event) => setProgramDraft({ ...programDraft, search: event.target.value })} placeholder="Nombre, cédula o correo" />
          </label>
          <label>Programa
            <select value={programDraft.programId} onChange={(event) => { const next = { ...programDraft, programId: event.target.value }; setProgramDraft(next); props.onProgramFilter(next); }}>
              <option value="">Todos</option>{props.programOptions.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </label>
          <FilterActions onClear={() => { const cleared = { search: "", programId: "", spaceId: "", relation: "" }; setProgramDraft(cleared); props.onProgramFilter(cleared); }} />
        </div>
        <AssignmentList assignments={props.programAssignments} pagination={props.programPagination} isLoading={props.isLoading} onPageChange={props.onProgramPageChange} onRemove={removeAssignment} />
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Espacios</p>
            <h2>Usuarios por espacio</h2>
          </div>
        </div>
        <div className="admin-filter-bar">
          <label className="filter-search-field">Buscar usuario o espacio
            <input value={spaceDraft.search} onChange={(event) => setSpaceDraft({ ...spaceDraft, search: event.target.value })} placeholder="Nombre, cédula o correo" />
          </label>
          <label>Programa
            <select value={spaceDraft.programId} onChange={(event) => { const next = { ...spaceDraft, programId: event.target.value, spaceId: "" }; setSpaceDraft(next); props.onSpaceFilter(next); }}>
              <option value="">Todos</option>{props.programOptions.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
          </label>
          <AdminSpacePicker value={spaceDraft.spaceId} programId={spaceDraft.programId} onChange={(spaceId) => { const next = { ...spaceDraft, spaceId }; setSpaceDraft(next); props.onSpaceFilter(next); }} />
          <label>Tipo de usuario
            <select value={spaceDraft.relation} onChange={(event) => { const next = { ...spaceDraft, relation: event.target.value }; setSpaceDraft(next); props.onSpaceFilter(next); }}>
              <option value="">Todos</option><option value="teacher">Docentes</option><option value="student">Estudiantes</option>
            </select>
          </label>
          <FilterActions onClear={() => { const cleared = { search: "", programId: "", spaceId: "", relation: "" }; setSpaceDraft(cleared); props.onSpaceFilter(cleared); }} />
        </div>
        <AssignmentList assignments={props.spaceAssignments} pagination={props.spacePagination} isLoading={props.isLoading} onPageChange={props.onSpacePageChange} onRemove={removeAssignment} />
      </div>
    </section>
  );
}

function AdminResultsPanel() {
  const [filters, setFilters] = useState({
    programId: "",
    academicSpaceId: "",
    teacherUserId: "",
    studentUserId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [results, setResults] = useState<AdminResultAttempt[]>([]);
  const [pagination, setPagination] = useState(EMPTY_PAGE);
  const [resultsPage, setResultsPage] = useState(1);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [metrics, setMetrics] = useState<AdminResultMetrics | null>(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [attemptDetail, setAttemptDetail] = useState<AdminAttemptDetail | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const filtersRef = useRef(filters);
  const resultsPageRef = useRef(resultsPage);
  const isFirstFilterRender = useRef(true);
  filtersRef.current = filters;
  resultsPageRef.current = resultsPage;

  useEffect(() => {
    void loadResults();
    void api.get<{ programs: ProgramOption[] }>("/admin/programs/options")
      .then((response) => setPrograms(response.data.programs))
      .catch(() => setError("No fue posible cargar los programas."));
    const refreshTimer = window.setInterval(() => void loadResults(true, filtersRef.current, resultsPageRef.current), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      setResultsPage(1);
      void loadResults(false, filters, 1);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [filters]);

  async function loadResults(isBackground = false, currentFilters = filters, page = resultsPage) {
    if (!isBackground) setIsLoadingResults(true);
    setError("");
    if (!isBackground) {
      setAttemptDetail(null);
      setSelectedAttemptId("");
    }

    const params = buildAdminResultParams(currentFilters);
    params.set("page", String(page));
    params.set("pageSize", String(ADMIN_PAGE_SIZE));

    try {
      const [resultsResponse, metricsResponse] = await Promise.all([
        api.get<{ results: AdminResultAttempt[]; pagination: PageMetadata }>(
          `/admin/results${params.size ? `?${params.toString()}` : ""}`,
        ),
        api.get<{ metrics: AdminResultMetrics }>(
          `/admin/results/metrics${params.size ? `?${params.toString()}` : ""}`,
        ),
      ]);
      setResults(resultsResponse.data.results);
      setPagination(resultsResponse.data.pagination);
      setResultsPage(resultsResponse.data.pagination.page);
      setMetrics(metricsResponse.data.metrics);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      if (!isBackground) setIsLoadingResults(false);
    }
  }

  async function exportResults(format: "csv" | "xlsx") {
    setError("");
    const params = buildAdminResultParams(filters);
    const mimeType = format === "csv"
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    try {
      const response = await api.get<Blob>(
        `/admin/results/export.${format}${params.size ? `?${params.toString()}` : ""}`,
        { responseType: "blob" },
      );
      const url = URL.createObjectURL(new Blob([response.data], { type: mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resultados-virtualchallenge-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    }
  }

  async function loadAttemptDetail(attemptId: string) {
    setSelectedAttemptId(attemptId);
    setAttemptDetail(null);
    setError("");
    setIsLoadingDetail(true);

    try {
      const response = await api.get<{ attempt: AdminAttemptDetail }>(`/admin/attempts/${attemptId}`);
      setAttemptDetail(response.data.attempt);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function updateFilter<K extends keyof typeof filters>(key: K, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "programId" ? { academicSpaceId: "" } : {}),
    }));
  }

  return (
    <section className="content-stack admin-results-workspace">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2>Resultados globales</h2>
          </div>
        </div>
        <form className="filter-grid" onSubmit={(event) => event.preventDefault()}>
          <label>
            Programa
            <select value={filters.programId} onChange={(event) => updateFilter("programId", event.target.value)}>
              <option value="">Todos</option>
              {programs.map((program) => (
                <option key={program.id} value={program.id}>{program.name}</option>
              ))}
            </select>
          </label>
          <AdminSpacePicker value={filters.academicSpaceId} programId={filters.programId} onChange={(value) => updateFilter("academicSpaceId", value)} />
          <AdminUserPicker role="docente" value={filters.teacherUserId} onChange={(value) => updateFilter("teacherUserId", value)} />
          <AdminUserPicker role="estudiante" value={filters.studentUserId} onChange={(value) => updateFilter("studentUserId", value)} />
          <label>
            Desde
            <input type="date" value={filters.dateFrom} onChange={(event) => updateFilter("dateFrom", event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={filters.dateTo} onChange={(event) => updateFilter("dateTo", event.target.value)} />
          </label>
          <div className="inline-form filter-actions">
            <button type="button" className="secondary-button" onClick={() => void exportResults("csv")}>
              Exportar CSV
            </button>
            <button type="button" className="secondary-button" onClick={() => void exportResults("xlsx")}>
              Exportar XLSX
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setFilters({
                  programId: "",
                  academicSpaceId: "",
                  teacherUserId: "",
                  studentUserId: "",
                  dateFrom: "",
                  dateTo: "",
                });
              }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {metrics ? <AdminResultMetricsPanel metrics={metrics} /> : null}

      <section className="results-grid admin-results-grid">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Intentos</p>
              <h2>Resultados encontrados</h2>
            </div>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          {isLoadingResults ? <p>Cargando resultados...</p> : null}
          {!isLoadingResults ? (
            <div className="table-like">
              {results.length === 0 ? (
                <div className="admin-row">
                  <div>
                    <strong>No hay resultados</strong>
                    <span>Ajusta los filtros o espera a que existan intentos evaluados.</span>
                  </div>
                </div>
              ) : null}
              {results.map((result) => (
                <AdminRow
                  key={result.id}
                  label={`${result.studentName} · ${result.liveTalkTitle}`}
                  value={`${result.programName} · ${result.academicSpaceName} · Docente: ${result.teacherName}`}
                  status={selectedAttemptId === result.id ? "Seleccionado" : formatAttemptStatus(result.status)}
                  actions={[
                    { label: "Ver detalle", onClick: () => void loadAttemptDetail(result.id) },
                  ]}
                />
              ))}
            </div>
          ) : null}
          <TablePagination pagination={pagination} isLoading={isLoadingResults} onPageChange={(page) => { setResultsPage(page); void loadResults(false, filters, page); }} />
        </div>

        <AdminAttemptResultPanel
          detail={attemptDetail}
          isLoading={isLoadingDetail}
        />
      </section>
    </section>
  );
}

function AdminResultMetricsPanel(props: {
  metrics: AdminResultMetrics;
}) {
  return (
    <div className="content-stack">
      <section className="metric-grid compact-metrics">
        <MetricCard label="Intentos" value={String(props.metrics.totalAttempts)} detail="Total filtrado" />
        <MetricCard label="Completados" value={String(props.metrics.completedAttempts)} detail="Conversaciones cerradas" />
        <MetricCard
          label="Promedio"
          value={props.metrics.averageScore === null ? "-" : String(props.metrics.averageScore)}
          detail="Nota efectiva"
        />
        <MetricCard label="Revisados" value={String(props.metrics.reviewedAttempts)} detail="Revisión docente" />
      </section>

      <section className="admin-grid admin-metric-breakdown">
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Programas</p>
              <h2>Resumen por programa</h2>
            </div>
          </div>
          <AdminMetricGroupList groups={props.metrics.byProgram} />
        </div>
        <div className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Espacios</p>
              <h2>Resumen por espacio</h2>
            </div>
          </div>
          <AdminMetricGroupList groups={props.metrics.bySpace} />
        </div>
      </section>
    </div>
  );
}

function AdminMetricGroupList(props: {
  groups: AdminResultMetrics["byProgram"];
}) {
  if (props.groups.length === 0) {
    return <p className="muted">No hay datos para los filtros seleccionados.</p>;
  }

  return (
    <div className="table-like">
      {props.groups.map((group) => (
        <div className="admin-row" key={group.id}>
          <div>
            <strong>{group.name}</strong>
            <span>{group.attemptsCount} intentos</span>
          </div>
          <div className="row-actions">
            <em>Promedio {group.averageScore ?? "-"}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminAttemptResultPanel(props: {
  detail: AdminAttemptDetail | null;
  isLoading: boolean;
}) {
  if (props.isLoading) {
    return <section className="panel"><p>Cargando detalle...</p></section>;
  }

  if (!props.detail) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Detalle global</p>
        <h2>Selecciona un intento</h2>
        <p className="muted">Aquí verás nota, revisión docente, rúbrica, evidencia, retroalimentación y transcripción.</p>
      </section>
    );
  }

  return (
    <section className="panel result-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Intento</p>
          <h2>{props.detail.studentName}</h2>
          <p className="muted">
            {props.detail.liveTalkTitle} · {props.detail.academicSpaceName} · Docente: {props.detail.teacherName}
          </p>
        </div>
        <div className="score-badge">
          <span>Nota</span>
          <strong>{getResultScoreValue(props.detail)}</strong>
        </div>
      </div>

      <div className="result-section">
        <h3>Contexto</h3>
        <p className="muted">
          {props.detail.programName} · {formatAttemptStatus(props.detail.status)} · Revisión docente: {props.detail.teacherReviewed ? "Sí" : "No"}
        </p>
        {props.detail.evaluationStatus === "failed" && props.detail.evaluationError ? (
          <p className="error-text">{props.detail.evaluationError}</p>
        ) : null}
        {props.detail.teacherOverrideReason ? <p>{props.detail.teacherOverrideReason}</p> : null}
      </div>

      {props.detail.feedback ? (
        <div className="result-section">
          <h3>Retroalimentación</h3>
          <p>{props.detail.feedback.summary}</p>
          <ResultTextBlock title="Fortalezas" text={props.detail.feedback.strengths} />
          <ResultTextBlock title="Aspectos por fortalecer" text={props.detail.feedback.improvementOpportunities} />
          <ResultTextBlock title="Recomendaciones" text={props.detail.feedback.recommendations} />
        </div>
      ) : null}

      <div className="result-section">
        <h3>Rúbrica por temática</h3>
        <div className="rubric-list">
          {props.detail.rubricItems.length === 0 ? <p className="muted">La rúbrica aún no está disponible.</p> : null}
          {props.detail.rubricItems.map((item) => (
            <article className="rubric-item" key={item.id}>
              <div className="rubric-header">
                <strong>{item.topic ?? "Tema evaluado"}</strong>
                <span>{item.score}/{item.maxScore}</span>
              </div>
              <p className="muted">{item.performanceLevel}</p>
              <p>{item.justification}</p>
              <div className="evidence-list">
                {item.evidence.length === 0 ? <span>Sin evidencia citada.</span> : null}
                {item.evidence.map((evidence) => (
                  <blockquote key={`${item.id}-${evidence.turn_id}-${evidence.fragment}`}>
                    <strong>T{evidence.turn_id}</strong> {evidence.fragment}
                  </blockquote>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="result-section">
        <h3>Transcripción normalizada</h3>
        <div className="transcript-list">
          {props.detail.transcript.length === 0 ? (
            <p className="muted">No hay transcripción registrada para este intento.</p>
          ) : null}
          {props.detail.transcript.map((turn) => (
            <article key={turn.turnId} className="transcript-turn">
              <span>T{turn.turnId} · {turn.speaker === "student" ? "Estudiante" : "Evaluador"}</span>
              <p>{turn.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function buildAdminResultParams(filters: {
  programId: string;
  academicSpaceId: string;
  teacherUserId: string;
  studentUserId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params;
}

function AdminUserPicker(props: {
  role: AppRole;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <RemoteAdminPicker
      label={props.role === "docente" ? "Docente" : "Estudiante"}
      placeholder="Nombre, cédula o correo"
      value={props.value}
      onChange={props.onChange}
      loadOptions={async (search) => {
        const response = await api.get<{ users: AdminUser[] }>("/admin/users", {
          params: { role: props.role, search, pageSize: 10 },
        });
        return response.data.users.map((user) => ({ id: user.id, label: `${user.name} · ${user.email}` }));
      }}
    />
  );
}

function AdminSpacePicker(props: {
  value: string;
  onChange: (value: string) => void;
  programId?: string;
}) {
  return (
    <RemoteAdminPicker
      label="Espacio académico"
      placeholder="Buscar espacio"
      value={props.value}
      onChange={props.onChange}
      programId={props.programId}
      loadOptions={async (search) => {
        const response = await api.get<{ academicSpaces: AcademicSpace[] }>("/admin/academic-spaces", {
          params: { search, programId: props.programId || undefined, pageSize: 10 },
        });
        return response.data.academicSpaces.map((space) => ({ id: space.id, label: space.name }));
      }}
    />
  );
}

function RemoteAdminPicker(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  loadOptions: (search: string) => Promise<SearchOption[]>;
  programId?: string;
}) {
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [selected, setSelected] = useState<SearchOption | null>(null);
  const [loading, setLoading] = useState(false);
  const loadRef = useRef(props.loadOptions);

  useEffect(() => {
    loadRef.current = props.loadOptions;
  }, [props.loadOptions]);

  useEffect(() => {
    if (props.value !== selected?.id) {
      setSelected(options.find((option) => option.id === props.value) ?? null);
    }
  }, [props.value, selected?.id, options]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      return;
    }
    const timer = window.setTimeout(() => {
      setLoading(true);
      void loadRef.current(term)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search, props.programId]);

  return (
    <label className="remote-picker">
      {props.label}
      <input
        value={selected && props.value ? selected.label : search}
        placeholder={props.placeholder}
        onChange={(event) => {
          const value = event.target.value;
          setSelected(null);
          setSearch(value);
          if (props.value) props.onChange("");
        }}
      />
      {loading ? <small>Buscando...</small> : null}
      {!loading && search.trim().length >= 2 ? (
        <select
          aria-label={`Resultados de ${props.label.toLowerCase()}`}
          size={Math.min(Math.max(options.length, 2), 5)}
          value={props.value}
          onChange={(event) => {
            const option = options.find((item) => item.id === event.target.value) ?? null;
            setSelected(option);
            setSearch("");
            props.onChange(option?.id ?? "");
          }}
        >
          <option value="">{options.length ? "Selecciona un resultado" : "Sin coincidencias"}</option>
          {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      ) : null}
    </label>
  );
}

function TablePagination(props: {
  pagination: PageMetadata;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages, totalItems, pageSize } = props.pagination;
  if (totalItems === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);
  return (
    <nav className="table-pagination" aria-label="Paginación de resultados">
      <span>{first}-{last} de {totalItems}</span>
      <div>
        <button type="button" className="secondary-button" disabled={page <= 1 || props.isLoading} onClick={() => props.onPageChange(page - 1)}>Anterior</button>
        <span>Página {page} de {totalPages}</span>
        <button type="button" className="secondary-button" disabled={page >= totalPages || props.isLoading} onClick={() => props.onPageChange(page + 1)}>Siguiente</button>
      </div>
    </nav>
  );
}

function useAutoAdminFilter<T extends { search: string }>(
  draft: T,
  onApply: (filters: T) => void,
  search: string,
) {
  const draftRef = useRef(draft);
  const applyRef = useRef(onApply);
  const isInitial = useRef(true);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { applyRef.current = onApply; }, [onApply]);
  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    const timer = window.setTimeout(() => applyRef.current(draftRef.current), 280);
    return () => window.clearTimeout(timer);
  }, [search]);
}

function FilterActions(props: { onClear: () => void }) {
  return (
    <div className="admin-filter-actions">
      <button type="button" className="secondary-button" onClick={props.onClear}>Limpiar filtros</button>
    </div>
  );
}

function AssignmentList(props: {
  assignments: AdminAssignment[];
  pagination: PageMetadata;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onRemove: (assignment: AdminAssignment) => Promise<void>;
}) {
  if (props.assignments.length === 0) {
    return <p className="muted">No hay asignaciones registradas.</p>;
  }

  return (
    <DataTable
      rows={props.assignments}
      compact
      emptyMessage="No hay asignaciones registradas."
      columns={[
        { label: "Elemento", render: (assignment) => assignment.targetName },
        { label: "Tipo", render: (assignment) => assignment.relation === "teacher" ? "Docente" : "Estudiante" },
        { label: "Usuario", render: (assignment) => <span className="assignment-user-cell"><strong>{assignment.userName}</strong><small>{assignment.userEmail}</small></span> },
      ]}
      actions={(assignment) => [{ label: "Desasignar", icon: "remove", onClick: () => void props.onRemove(assignment) }]}
      pagination={props.pagination}
      isLoading={props.isLoading}
      onPageChange={props.onPageChange}
    />
  );
}

function ConfirmDialog(props: {
  confirmation: NonNullable<ConfirmationState>;
  onClose: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setIsSubmitting(true);
    setError("");

    try {
      await props.confirmation.onConfirm();
      props.onClose();
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div>
          <p className="eyebrow">Confirmación</p>
          <h2 id="confirm-title">{props.confirmation.title}</h2>
          <p className="muted">{props.confirmation.message}</p>
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={props.onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="button" onClick={() => void confirm()} disabled={isSubmitting}>
            {isSubmitting ? "Procesando..." : props.confirmation.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? "No fue posible completar la operación.";
  }

  return "No fue posible completar la operación.";
}

function TeacherHome(props: {
  user: AppUser | null;
}) {
  const [activeSection, setActiveSection] = useState<"live-talks" | "resultados">("live-talks");
  const [spaces, setSpaces] = useState<TeacherAcademicSpace[]>([]);
  const [liveTalks, setLiveTalks] = useState<TeacherLiveTalk[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);

  async function loadTeacherData() {
    setError("");

    try {
      const [spacesResponse, liveTalksResponse] = await Promise.all([
        api.get<{ academicSpaces: TeacherAcademicSpace[] }>("/teacher/academic-spaces"),
        api.get<{ liveTalks: TeacherLiveTalk[] }>("/teacher/live-talks"),
      ]);

      setSpaces(spacesResponse.data.academicSpaces);
      setLiveTalks(liveTalksResponse.data.liveTalks);
    } catch {
      setError("No fue posible cargar la información docente.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTeacherData();
    const refreshTimer = window.setInterval(() => void loadTeacherData(), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  return (
    <section className="role-workspace">
      <section className="workspace-hero teacher-hero">
        <div className="hero-copy">
          <p className="eyebrow">Docente</p>
          <h1>{props.user?.name ?? "Panel docente"}</h1>
          <p>
            Diseña evaluaciones conversacionales, activa sesiones para tus espacios y revisa
            evidencia con trazabilidad.
          </p>
        </div>
        <div className="hero-media">
          <img src={tutorImage} alt="" />
        </div>
        <div className="hero-badge">
          <span>Espacios</span>
          <strong>{spaces.length}</strong>
        </div>
      </section>

      <nav className="role-tabs" aria-label="Navegación docente">
        <button
          type="button"
          className={activeSection === "live-talks" ? "active" : ""}
          onClick={() => setActiveSection("live-talks")}
        >
          Live Talks
        </button>
        <button
          type="button"
          className={activeSection === "resultados" ? "active" : ""}
          onClick={() => setActiveSection("resultados")}
        >
          Resultados
        </button>
      </nav>

      <section className="metric-grid compact-metrics">
        <MetricCard label="Espacios" value={String(spaces.length)} detail="Asignados al docente" />
        <MetricCard label="Live Talks" value={String(liveTalks.length)} detail="Creados en tus espacios" />
        <MetricCard
          label="Activos"
          value={String(liveTalks.filter((liveTalk) => liveTalk.status === "active").length)}
          detail="Disponibles para estudiantes"
        />
        <MetricCard
          label="Cerrados"
          value={String(liveTalks.filter((liveTalk) => liveTalk.status === "closed").length)}
          detail="Listos para seguimiento"
        />
      </section>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <section className="panel"><p>Cargando datos docente...</p></section> : null}
      {!isLoading && activeSection === "live-talks" ? (
        <TeacherLiveTalkPanel
          spaces={spaces}
          liveTalks={liveTalks}
          onChanged={loadTeacherData}
          confirm={setConfirmation}
          showError={setError}
        />
      ) : null}
      {!isLoading && activeSection === "resultados" ? (
        <TeacherResultsPanel liveTalks={liveTalks} />
      ) : null}

      {confirmation ? (
        <ConfirmDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
      ) : null}
    </section>
  );
}

function TeacherLiveTalkPanel(props: {
  spaces: TeacherAcademicSpace[];
  liveTalks: TeacherLiveTalk[];
  onChanged: () => Promise<void>;
  confirm: (confirmation: ConfirmationState) => void;
  showError: (message: string) => void;
}) {
  const firstSpaceId = props.spaces[0]?.id ?? "";
  const [editingLiveTalkId, setEditingLiveTalkId] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [form, setForm] = useState({
    academicSpaceId: firstSpaceId,
    title: "",
    generalTopic: "",
    topics: [] as string[],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.academicSpaceId && firstSpaceId) {
      setForm((current) => ({ ...current, academicSpaceId: firstSpaceId }));
    }
  }, [firstSpaceId, form.academicSpaceId]);

  function resetForm() {
    setEditingLiveTalkId(null);
    setTopicInput("");
    setForm({
      academicSpaceId: firstSpaceId,
      title: "",
      generalTopic: "",
      topics: [],
    });
  }

  function editLiveTalk(liveTalk: TeacherLiveTalk) {
    setEditingLiveTalkId(liveTalk.id);
    setForm({
      academicSpaceId: liveTalk.academicSpaceId,
      title: liveTalk.title,
      generalTopic: liveTalk.generalTopic,
      topics: liveTalk.topics,
    });
  }

  function addTopic() {
    const normalizedTopic = topicInput.trim();

    if (!normalizedTopic) {
      return;
    }

    setForm({ ...form, topics: [...form.topics, normalizedTopic] });
    setTopicInput("");
  }

  function removeTopic(topicIndex: number) {
    setForm({
      ...form,
      topics: form.topics.filter((_, index) => index !== topicIndex),
    });
  }

  async function saveLiveTalk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (form.topics.length === 0) {
      setError("Agrega al menos una temática específica.");
      return;
    }

    try {
      if (editingLiveTalkId) {
        await api.patch(`/teacher/live-talks/${editingLiveTalkId}`, form);
      } else {
        await api.post("/teacher/live-talks", form);
      }

      resetForm();
      await props.onChanged();
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    }
  }

  async function changeStatus(liveTalk: TeacherLiveTalk, status: LiveTalkStatus) {
    props.confirm({
      title: status === "active" ? "Activar live talk" : "Cerrar live talk",
      message: `${liveTalk.title} pasará a estado ${status === "active" ? "activo" : "cerrado"}.`,
      confirmLabel: status === "active" ? "Activar" : "Cerrar",
      onConfirm: async () => {
        await api.patch(`/teacher/live-talks/${liveTalk.id}/status`, { status });
        await props.onChanged();
      },
    });
  }

  async function deleteLiveTalk(liveTalk: TeacherLiveTalk) {
    props.confirm({
      title: "Eliminar live talk",
      message: `Se eliminará ${liveTalk.title}. Solo es posible eliminar live talks en borrador.`,
      confirmLabel: "Eliminar",
      onConfirm: async () => {
        try {
          await api.delete(`/teacher/live-talks/${liveTalk.id}`);
          await props.onChanged();
        } catch (unknownError) {
          props.showError(getApiErrorMessage(unknownError));
        }
      },
    });
  }

  return (
    <section className="admin-grid">
      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Live Talks</p>
            <h2>Evaluaciones conversacionales</h2>
          </div>
        </div>

        <div className="table-like">
          {props.liveTalks.length === 0 ? (
            <div className="admin-row">
              <div>
                <strong>No hay live talks creados</strong>
                <span>Crea el primero desde el formulario.</span>
              </div>
            </div>
          ) : null}
          {props.liveTalks.map((liveTalk) => (
            <AdminRow
              key={liveTalk.id}
              label={`${liveTalk.title} · ${liveTalk.academicSpaceName}`}
              value={`${liveTalk.generalTopic} · ${liveTalk.topics.length} temáticas`}
              status={formatLiveTalkStatus(liveTalk.status)}
              actions={[
                ...(liveTalk.status === "draft"
                  ? [
                    { label: "Editar", onClick: () => editLiveTalk(liveTalk) },
                    { label: "Activar", onClick: () => void changeStatus(liveTalk, "active") },
                    { label: "Eliminar", onClick: () => void deleteLiveTalk(liveTalk) },
                  ]
                  : []),
                ...(liveTalk.status === "active"
                  ? [{ label: "Cerrar", onClick: () => void changeStatus(liveTalk, "closed") }]
                  : []),
              ]}
            />
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Configuración</p>
            <h2>{editingLiveTalkId ? "Editar live talk" : "Crear live talk"}</h2>
          </div>
        </div>
        <form className="form-stack" onSubmit={saveLiveTalk}>
          <label>
            Espacio académico
            <select
              value={form.academicSpaceId}
              onChange={(event) => setForm({ ...form, academicSpaceId: event.target.value })}
              required
            >
              {props.spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name} · {space.programName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Título
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label>
            Tema general
            <input value={form.generalTopic} onChange={(event) => setForm({ ...form, generalTopic: event.target.value })} required />
          </label>
          <div className="inline-form">
            <input
              value={topicInput}
              onChange={(event) => setTopicInput(event.target.value)}
              placeholder="Temática específica"
            />
            <button type="button" onClick={addTopic}>Agregar</button>
          </div>
          <div className="topic-chips">
            {form.topics.map((topic, index) => (
              <button key={`${topic}-${index}`} type="button" onClick={() => removeTopic(index)}>
                {topic} x
              </button>
            ))}
          </div>
          {error ? <p className="error-text">{error}</p> : null}
          <div className="inline-form">
            <button type="submit" disabled={props.spaces.length === 0}>
              {editingLiveTalkId ? "Guardar live talk" : "Crear live talk"}
            </button>
            {editingLiveTalkId ? <button type="button" className="secondary-button" onClick={resetForm}>Cancelar</button> : null}
          </div>
        </form>
      </div>
    </section>
  );
}

function TeacherResultsPanel(props: {
  liveTalks: TeacherLiveTalk[];
}) {
  const [selectedLiveTalkId, setSelectedLiveTalkId] = useState(props.liveTalks[0]?.id ?? "");
  const [results, setResults] = useState<TeacherResultAttempt[]>([]);
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [attemptDetail, setAttemptDetail] = useState<TeacherAttemptDetail | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const talksBySpace = Array.from(
    props.liveTalks.reduce((groups, liveTalk) => {
      const current = groups.get(liveTalk.academicSpaceName) ?? [];
      current.push(liveTalk);
      groups.set(liveTalk.academicSpaceName, current);
      return groups;
    }, new Map<string, TeacherLiveTalk[]>()),
  );

  useEffect(() => {
    if (!selectedLiveTalkId && props.liveTalks[0]?.id) {
      setSelectedLiveTalkId(props.liveTalks[0].id);
    }
  }, [props.liveTalks, selectedLiveTalkId]);

  useEffect(() => {
    if (!selectedLiveTalkId) {
      setResults([]);
      return;
    }

    let isMounted = true;

    async function loadResults() {
      setIsLoadingResults(true);
      setError("");
      setResults([]);
      setAttemptDetail(null);
      setSelectedAttemptId("");

      try {
        const response = await api.get<{ results: TeacherResultAttempt[] }>(
          `/teacher/live-talks/${selectedLiveTalkId}/results`,
        );

        if (isMounted) {
          setResults(response.data.results);
        }
      } catch (unknownError) {
        if (isMounted) {
          setError(getApiErrorMessage(unknownError));
        }
      } finally {
        if (isMounted) {
          setIsLoadingResults(false);
        }
      }
    }

    void loadResults();
    const refreshTimer = window.setInterval(() => {
      void api.get<{ results: TeacherResultAttempt[] }>(`/teacher/live-talks/${selectedLiveTalkId}/results`)
        .then((response) => {
          if (isMounted) setResults(response.data.results);
        })
        .catch((unknownError) => {
          if (isMounted) setError(getApiErrorMessage(unknownError));
        });
    }, 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(refreshTimer);
    };
  }, [selectedLiveTalkId]);

  async function loadAttemptDetail(attemptId: string) {
    setSelectedAttemptId(attemptId);
    setAttemptDetail(null);
    setError("");
    setIsLoadingDetail(true);

    try {
      const response = await api.get<{ attempt: TeacherAttemptDetail }>(`/teacher/attempts/${attemptId}`);
      setAttemptDetail(response.data.attempt);
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  return (
    <section className="results-grid teacher-results-grid" aria-label="Histórico de resultados">
      <div className="content-stack teacher-results-list">
        <div className="panel teacher-results-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Resultados</p>
              <h2>Live talks evaluados</h2>
            </div>
          </div>
          {props.liveTalks.length > 0 ? (
            <div className="teacher-space-tree" aria-label="Resultados por espacio académico">
              {talksBySpace.map(([spaceName, spaceTalks]) => (
                <details
                  className="teacher-space-node"
                  key={spaceName}
                  open={spaceTalks.some((liveTalk) => liveTalk.id === selectedLiveTalkId)}
                  onToggle={(event) => {
                    if (event.currentTarget.open && !spaceTalks.some((liveTalk) => liveTalk.id === selectedLiveTalkId)) {
                      setSelectedLiveTalkId(spaceTalks[0]?.id ?? "");
                    }
                  }}
                >
                  <summary className="teacher-space-node-label">
                    <strong>{spaceName}</strong><small>{spaceTalks.length} categorías</small>
                  </summary>
                  <div className="teacher-space-node-children">
                    {spaceTalks.map((liveTalk) => (
                      <details
                        className="teacher-live-talk-accordion"
                        key={liveTalk.id}
                        open={selectedLiveTalkId === liveTalk.id}
                        onToggle={(event) => {
                          if (event.currentTarget.open && selectedLiveTalkId !== liveTalk.id) {
                            setSelectedLiveTalkId(liveTalk.id);
                          }
                        }}
                      >
                        <summary>
                          <span className="teacher-result-tree-path">
                            <strong>{liveTalk.title}</strong>
                            <em>Resultados</em>
                          </span>
                          <span className="teacher-result-tree-meta">{liveTalk.generalTopic} · {liveTalk.topics.length} temáticas · {formatLiveTalkStatus(liveTalk.status)}</span>
                        </summary>
                        {selectedLiveTalkId === liveTalk.id ? (
                          <div className="teacher-accordion-results">
                            {error ? <p className="error-text">{error}</p> : null}
                            {isLoadingResults ? <p className="muted">Cargando resultados...</p> : null}
                            {!isLoadingResults && results.length === 0 ? <p className="muted">No hay intentos registrados.</p> : null}
                            {!isLoadingResults ? results.map((result) => (
                              <button
                                className={`teacher-attempt-item ${selectedAttemptId === result.id ? "active" : ""}`}
                                key={result.id}
                                type="button"
                                aria-pressed={selectedAttemptId === result.id}
                                onClick={() => void loadAttemptDetail(result.id)}
                              >
                                <strong>{result.studentName}</strong>
                                <span>{result.studentEmail}</span>
                                <span>{getResultScoreLabel(result)} · {formatAttemptStatus(result.status)}</span>
                              </button>
                            )) : null}
                          </div>
                        ) : null}
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <p className="muted">No hay live talks creados para consultar.</p>
          )}
        </div>
      </div>

      <TeacherAttemptResultPanel
        detail={attemptDetail}
        isLoading={isLoadingDetail}
        onReviewSaved={async () => {
          if (selectedAttemptId) {
            await loadAttemptDetail(selectedAttemptId);
          }

          if (selectedLiveTalkId) {
            const response = await api.get<{ results: TeacherResultAttempt[] }>(
              `/teacher/live-talks/${selectedLiveTalkId}/results`,
            );
            setResults(response.data.results);
          }
        }}
      />
    </section>
  );
}

function TeacherAttemptResultPanel(props: {
  detail: TeacherAttemptDetail | null;
  isLoading: boolean;
  onReviewSaved: () => Promise<void>;
}) {
  if (props.isLoading) {
    return <section className="panel"><p>Cargando detalle...</p></section>;
  }

  if (!props.detail) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Detalle</p>
        <h2>Selecciona un intento</h2>
        <p className="muted">Aquí verás nota, rúbrica, evidencia, retroalimentación y transcripción.</p>
      </section>
    );
  }

  return (
    <section className="panel result-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Intento estudiante</p>
          <h2>{props.detail.studentName}</h2>
          <p className="muted">{props.detail.liveTalkTitle} · {props.detail.academicSpaceName}</p>
        </div>
        <div className="score-badge">
          <span>Nota</span>
          <strong>{getResultScoreValue(props.detail)}</strong>
        </div>
      </div>

      <div className="result-section">
        <h3>Estado académico</h3>
        <p className="muted">
          {formatAttemptStatus(props.detail.status)} · Revisión docente: {props.detail.teacherReviewed ? "Sí" : "No"}
        </p>
        {props.detail.evaluationStatus === "failed" && props.detail.evaluationError ? (
          <p className="error-text">{props.detail.evaluationError}</p>
        ) : null}
        {props.detail.teacherOverrideReason ? (
          <p>{props.detail.teacherOverrideReason}</p>
        ) : null}
      </div>

      <TeacherReviewForm detail={props.detail} onReviewSaved={props.onReviewSaved} />

      {props.detail.feedback ? (
        <div className="result-section">
          <h3>Retroalimentación</h3>
          <p>{props.detail.feedback.summary}</p>
          <ResultTextBlock title="Fortalezas" text={props.detail.feedback.strengths} />
          <ResultTextBlock title="Aspectos por fortalecer" text={props.detail.feedback.improvementOpportunities} />
          <ResultTextBlock title="Recomendaciones" text={props.detail.feedback.recommendations} />
        </div>
      ) : (
        <div className="result-section">
          <h3>Retroalimentación</h3>
          <p className="muted">La retroalimentación aún no está disponible.</p>
        </div>
      )}

      <div className="result-section">
        <h3>Rúbrica por temática</h3>
        <div className="rubric-list">
          {props.detail.rubricItems.length === 0 ? (
            <p className="muted">La rúbrica aún no está disponible.</p>
          ) : null}
          {props.detail.rubricItems.map((item) => (
            <article className="rubric-item" key={item.id}>
              <div className="rubric-header">
                <strong>{item.topic ?? "Tema evaluado"}</strong>
                <span>{item.score}/{item.maxScore}</span>
              </div>
              <p className="muted">{item.performanceLevel}</p>
              <p>{item.justification}</p>
              <div className="evidence-list">
                {item.evidence.length === 0 ? <span>Sin evidencia citada.</span> : null}
                {item.evidence.map((evidence) => (
                  <blockquote key={`${item.id}-${evidence.turn_id}-${evidence.fragment}`}>
                    <strong>T{evidence.turn_id}</strong> {evidence.fragment}
                  </blockquote>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="result-section">
        <h3>Transcripción normalizada</h3>
        <div className="transcript-list">
          {props.detail.transcript.length === 0 ? (
            <p className="muted">No hay transcripción registrada para este intento.</p>
          ) : null}
          {props.detail.transcript.map((turn) => (
            <article key={turn.turnId} className="transcript-turn">
              <span>T{turn.turnId} · {turn.speaker === "student" ? "Estudiante" : "Evaluador"}</span>
              <p>{turn.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function TeacherReviewForm(props: {
  detail: TeacherAttemptDetail;
  onReviewSaved: () => Promise<void>;
}) {
  const [teacherReviewed, setTeacherReviewed] = useState(true);
  const [overrideEnabled, setOverrideEnabled] = useState(props.detail.teacherOverrideGrade !== null);
  const [overrideGrade, setOverrideGrade] = useState(
    props.detail.teacherOverrideGrade?.toString() ?? props.detail.finalScore?.toString() ?? "",
  );
  const [overrideReason, setOverrideReason] = useState(props.detail.teacherOverrideReason ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setTeacherReviewed(true);
    setOverrideEnabled(props.detail.teacherOverrideGrade !== null);
    setOverrideGrade(props.detail.teacherOverrideGrade?.toString() ?? props.detail.finalScore?.toString() ?? "");
    setOverrideReason(props.detail.teacherOverrideReason ?? "");
    setError("");
    setMessage("");
  }, [props.detail.id, props.detail.teacherOverrideGrade, props.detail.teacherOverrideReason, props.detail.finalScore]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const parsedOverrideGrade = overrideEnabled ? Number(overrideGrade) : null;

    if (
      overrideEnabled &&
      (parsedOverrideGrade === null || !Number.isFinite(parsedOverrideGrade) ||
        parsedOverrideGrade < 0 || parsedOverrideGrade > 5)
    ) {
      setError("La nota ajustada debe estar entre 0 y 5.");
      return;
    }

    if (overrideEnabled && overrideReason.trim().length === 0) {
      setError("El ajuste de nota requiere una justificación.");
      return;
    }

    setIsSubmitting(true);

    try {
      await api.patch(`/teacher/attempts/${props.detail.id}/review`, {
        teacherReviewed,
        teacherOverrideGrade: overrideEnabled ? parsedOverrideGrade : null,
        teacherOverrideReason: overrideEnabled ? overrideReason.trim() : null,
      });
      setMessage("Revisión docente guardada.");
      await props.onReviewSaved();
    } catch (unknownError) {
      setError(getApiErrorMessage(unknownError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="result-section review-form" onSubmit={submitReview}>
      <h3>Revisión docente</h3>
      {props.detail.evaluationStatus === "failed" ? (
        <p className="error-text">No se puede revisar una evaluación fallida hasta que exista una nota calculada.</p>
      ) : null}
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={teacherReviewed}
          onChange={(event) => setTeacherReviewed(event.target.checked)}
        />
        Marcar como revisado
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={overrideEnabled}
          onChange={(event) => setOverrideEnabled(event.target.checked)}
        />
        Ajustar nota con justificación
      </label>
      {overrideEnabled ? (
        <>
          <label>
            Nota ajustada
            <input
              type="number"
              min="0"
              max="5"
              step="0.01"
              value={overrideGrade}
              onChange={(event) => setOverrideGrade(event.target.value)}
              required
            />
          </label>
          <label>
            Justificación del ajuste
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              required
            />
          </label>
        </>
      ) : null}
      {error ? <p className="error-text">{error}</p> : null}
      {message ? <p className="success-text">{message}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting || props.detail.evaluationId === null || props.detail.finalScore === null}
      >
        {isSubmitting ? "Guardando..." : "Guardar revisión"}
      </button>
    </form>
  );
}

function formatLiveTalkStatus(status: LiveTalkStatus) {
  if (status === "draft") return "Borrador";
  if (status === "active") return "Activo";
  return "Cerrado";
}

function StudentHome(props: {
  user: AppUser | null;
}) {
  const [activeTab, setActiveTab] = useState<"live-talks" | "history">("live-talks");
  const [liveTalks, setLiveTalks] = useState<StudentLiveTalk[]>([]);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [selectedLiveTalkId, setSelectedLiveTalkId] = useState("");
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function loadStudentData() {
    setError("");

    try {
      const [liveTalksResponse, attemptsResponse] = await Promise.all([
        api.get<{ liveTalks: StudentLiveTalk[] }>("/student/live-talks"),
        api.get<{ attempts: StudentAttempt[] }>("/student/attempts"),
      ]);

      setLiveTalks(liveTalksResponse.data.liveTalks);
      setAttempts(attemptsResponse.data.attempts);
      setCurrentTime(Date.now());
      setSelectedLiveTalkId((current) => current || liveTalksResponse.data.liveTalks[0]?.id || "");
    } catch {
      setError("No fue posible cargar tus live talks o histórico.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadStudentData();
    const refreshTimer = window.setInterval(() => void loadStudentData(), 30_000);
    return () => {
      window.clearInterval(refreshTimer);
    };
  }, []);

  const selectedLiveTalk = liveTalks.find((liveTalk) => liveTalk.id === selectedLiveTalkId) ?? null;
  const isScheduled = (liveTalk: StudentLiveTalk) => Boolean(
    currentTime > 0 && liveTalk.opensAt && new Date(liveTalk.opensAt).getTime() > currentTime,
  );
  const scheduledLiveTalks = liveTalks.filter(isScheduled);
  const availableLiveTalks = liveTalks.filter((liveTalk) => !isScheduled(liveTalk));

  return (
    <section className="role-workspace student-workspace">
      <section className="workspace-hero student-hero">
        <div className="hero-copy">
          <p className="eyebrow">Estudiante</p>
          <h1>{props.user?.name ?? "Panel estudiante"}</h1>
          <p>
            Entra a un live talk activo, conversa por voz y revisa tu evidencia cuando
            finalice la evaluación.
          </p>
        </div>
        <div className="hero-media">
          <img src={sessionImage} alt="" />
        </div>
        <div className="hero-badge">
          <span>Intentos</span>
          <strong>{attempts.length}</strong>
        </div>
      </section>

      <section className="metric-grid compact-metrics">
        <MetricCard label="Live Talks" value={String(liveTalks.length)} detail="Activos para ti" />
        <MetricCard
          label="Completados"
          value={String(attempts.filter((attempt) => attempt.status === "completed").length)}
          detail="Conversaciones cerradas"
        />
        <MetricCard
          label="Evaluados"
          value={String(attempts.filter((attempt) => attempt.evaluationStatus === "completed").length)}
          detail="Con rúbrica disponible"
        />
        <MetricCard
          label="Promedio"
          value={formatAverageScore(attempts)}
          detail="Notas calculadas"
        />
      </section>

      <nav className="role-tabs student-tabs" aria-label="Navegación estudiante">
        <button type="button" className={activeTab === "live-talks" ? "active" : ""} onClick={() => setActiveTab("live-talks")}>
          Live Talks
        </button>
        <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
          Histórico <span>{attempts.length}</span>
        </button>
      </nav>

      {error ? <p className="error-text">{error}</p> : null}
      {isLoading ? <section className="panel"><p>Cargando live talks...</p></section> : null}
      {!isLoading && activeTab === "live-talks" ? (
        <section className="student-live-grid">
          <div className="student-live-sidebar">
            <StudentLiveTalkGroup
              title="Activos"
              liveTalks={availableLiveTalks}
              selectedId={selectedLiveTalkId}
              now={currentTime}
              onSelect={setSelectedLiveTalkId}
              emptyMessage="No hay live talks disponibles ahora."
            />
            {scheduledLiveTalks.length > 0 ? (
              <StudentLiveTalkGroup
                title="Pendientes"
                liveTalks={scheduledLiveTalks}
                selectedId={selectedLiveTalkId}
                now={currentTime}
                onSelect={setSelectedLiveTalkId}
                emptyMessage=""
              />
            ) : null}
          </div>

          {selectedLiveTalk ? (
            <StudentLiveTalkDetail
              liveTalk={selectedLiveTalk}
              isScheduled={isScheduled(selectedLiveTalk)}
              onAttemptFinished={loadStudentData}
            />
          ) : (
            <section className="panel live-talk-stage">
              <p className="muted">Selecciona un live talk activo para iniciar.</p>
            </section>
          )}
        </section>
      ) : null}
      {!isLoading && activeTab === "history" ? <StudentAttemptsPanel attempts={attempts} /> : null}
    </section>
  );
}

function StudentLiveTalkDetail(props: {
  liveTalk: StudentLiveTalk;
  isScheduled: boolean;
  onAttemptFinished: () => Promise<void>;
}) {
  const [isImmersive, setIsImmersive] = useState(false);

  return (
    <section className={`live-talk-stage ${isImmersive ? "is-immersive" : ""}`}>
      <div className="live-talk-content">
        {isImmersive ? (
          <div className="immersive-toolbar">
            <button className="secondary-button" type="button" onClick={() => setIsImmersive(false)}>
              Volver al panel
            </button>
          </div>
        ) : null}
        <div>
          <p className="eyebrow">{props.liveTalk.academicSpaceName}</p>
          <h2>{props.liveTalk.title}</h2>
          <p className="muted">{props.liveTalk.generalTopic}</p>
        </div>
        <div className="live-talk-meta">
          <span>{props.liveTalk.programName}</span>
          {props.liveTalk.opensAt ? <span>Disponible desde {formatDateTime(props.liveTalk.opensAt)}</span> : null}
        </div>
        <div className="topic-chips topic-chips-static">
          {props.liveTalk.topics.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
        {props.isScheduled ? (
          <div className="scheduled-talk-notice">
            <strong>Live Talk pendiente</strong>
            <span>Estará disponible desde {formatDateTime(props.liveTalk.opensAt)}.</span>
          </div>
        ) : (
          <VoiceChat
            liveTalkId={props.liveTalk.id}
            onAttemptFinished={props.onAttemptFinished}
            onImmersiveChange={setIsImmersive}
          />
        )}
      </div>
    </section>
  );
}

function StudentLiveTalkGroup(props: {
  title: string;
  liveTalks: StudentLiveTalk[];
  selectedId: string;
  now: number;
  onSelect: (liveTalkId: string) => void;
  emptyMessage: string;
}) {
  return (
    <section className="panel student-live-group">
      <div className="section-heading"><h2>{props.title}</h2><span>{props.liveTalks.length}</span></div>
      {props.liveTalks.length === 0 ? <p className="muted">{props.emptyMessage}</p> : null}
      <div className="selectable-card-list">
        {props.liveTalks.map((liveTalk) => (
          <button
            key={liveTalk.id}
            type="button"
            className={`selectable-card ${props.selectedId === liveTalk.id ? "active" : ""}`}
            aria-pressed={props.selectedId === liveTalk.id}
            onClick={() => props.onSelect(liveTalk.id)}
          >
            <span className="selectable-card-kicker">{liveTalk.academicSpaceName}</span>
            <strong>{liveTalk.title}</strong>
            <span>{liveTalk.programName} · {liveTalk.topics.length} temáticas</span>
            <em>{liveTalk.opensAt && props.now > 0 && new Date(liveTalk.opensAt).getTime() > props.now ? "Pendiente" : "Disponible"}</em>
          </button>
        ))}
      </div>
    </section>
  );
}

function StudentAttemptsPanel(props: {
  attempts: StudentAttempt[];
}) {
  const initialSpaceName = props.attempts[0]
    ? `${props.attempts[0].academicSpaceName} · ${props.attempts[0].programName}`
    : "";
  const [selectedAttemptId, setSelectedAttemptId] = useState("");
  const [selectedSpaceName, setSelectedSpaceName] = useState(initialSpaceName);
  const [attemptDetail, setAttemptDetail] = useState<StudentAttemptDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const attemptNumbers = getStudentAttemptNumbers(props.attempts);
  const groupedAttempts = Array.from(
    props.attempts.reduce((groups, attempt) => {
      const spaceName = `${attempt.academicSpaceName} · ${attempt.programName}`;
      const current = groups.get(spaceName) ?? [];
      current.push(attempt);
      groups.set(spaceName, current);
      return groups;
    }, new Map<string, StudentAttempt[]>()),
  );
  async function loadAttemptDetail(attemptId: string) {
    setSelectedAttemptId(attemptId);
    setAttemptDetail(null);
    setDetailError("");
    setIsLoadingDetail(true);

    try {
      const response = await api.get<{ attempt: StudentAttemptDetail }>(`/student/attempts/${attemptId}`);
      setAttemptDetail(response.data.attempt);
    } catch (error) {
      setDetailError(getApiErrorMessage(error));
    } finally {
      setIsLoadingDetail(false);
    }
  }

  return (
    <section className="student-history-workspace">
      <aside className="student-history-sidebar">
        <div className="student-history-sidebar-heading">
          <p className="eyebrow">Histórico</p>
          <h2>Espacios académicos</h2>
        </div>
        {groupedAttempts.length === 0 ? <p className="muted">Tu histórico aparecerá después de iniciar un Live Talk.</p> : null}
        {groupedAttempts.map(([spaceName, spaceAttempts]) => (
          <details
            className="student-history-group"
            key={spaceName}
            open={selectedSpaceName === spaceName}
            onToggle={(event) => {
              if (event.currentTarget.open) setSelectedSpaceName(spaceName);
              else if (selectedSpaceName === spaceName) setSelectedSpaceName("");
            }}
          >
            <summary className="student-history-space">
              <span>{spaceName}</span><small>{spaceAttempts.length} intentos</small>
            </summary>
            {selectedSpaceName === spaceName ? (
              <div className="student-history-items">
                {spaceAttempts.map((attempt) => (
                  <button
                    className={`student-history-item ${selectedAttemptId === attempt.id ? "active" : ""}`}
                    key={attempt.id}
                    type="button"
                    onClick={() => void loadAttemptDetail(attempt.id)}
                  >
                    <span className="student-attempt-number">{attemptNumbers.get(attempt.id) ?? "Intento"}</span>
                    <strong>{attempt.liveTalkTitle}</strong>
                    <time dateTime={attempt.startedAt}>{formatDateTime(attempt.startedAt)}</time>
                    <small>{getResultScoreLabel(attempt)} · {formatAttemptStatus(attempt.status)}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </details>
        ))}
      </aside>

      <StudentAttemptResultPanel
        detail={attemptDetail}
        isLoading={isLoadingDetail}
        error={detailError}
      />
    </section>
  );
}

function StudentAttemptResultPanel(props: {
  detail: StudentAttemptDetail | null;
  isLoading: boolean;
  error: string;
}) {
  if (props.isLoading) {
    return <section className="panel"><p>Cargando resultado...</p></section>;
  }

  if (props.error) {
    return <section className="panel"><p className="error-text">{props.error}</p></section>;
  }

  if (!props.detail) {
    return (
      <section className="panel empty-state">
        <p className="eyebrow">Resultado</p>
        <h2>Selecciona un intento</h2>
        <p className="muted">Aquí verás la nota, rúbrica, evidencia y retroalimentación.</p>
      </section>
    );
  }

  return (
    <section className="panel result-detail">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resultado</p>
          <h2>{props.detail.liveTalkTitle}</h2>
          <p className="muted">{props.detail.academicSpaceName} · {props.detail.programName}</p>
        </div>
        <div className="score-badge">
          <span>Nota</span>
          <strong>{getResultScoreValue(props.detail)}</strong>
        </div>
      </div>

      {props.detail.feedback ? (
        <div className="result-section">
          <h3>Retroalimentación</h3>
          <p>{props.detail.feedback.summary}</p>
          <ResultTextBlock title="Fortalezas" text={props.detail.feedback.strengths} />
          <ResultTextBlock title="Aspectos por fortalecer" text={props.detail.feedback.improvementOpportunities} />
          <ResultTextBlock title="Recomendaciones" text={props.detail.feedback.recommendations} />
        </div>
      ) : (
        <p className="muted">La retroalimentación aún no está disponible.</p>
      )}
      {props.detail.evaluationStatus === "failed" && props.detail.evaluationError ? (
        <p className="error-text">{props.detail.evaluationError}</p>
      ) : null}

      <div className="result-section">
        <h3>Rúbrica por temática</h3>
        <div className="rubric-list">
          {props.detail.rubricItems.length === 0 ? (
            <p className="muted">La rúbrica aún no está disponible.</p>
          ) : null}
          {props.detail.rubricItems.map((item) => (
            <article className="rubric-item" key={item.id}>
              <div className="rubric-header">
                <strong>{item.topic ?? "Tema evaluado"}</strong>
                <span>{item.score}/{item.maxScore}</span>
              </div>
              <p className="muted">{item.performanceLevel}</p>
              <p>{item.justification}</p>
              <div className="evidence-list">
                {item.evidence.length === 0 ? <span>Sin evidencia citada.</span> : null}
                {item.evidence.map((evidence) => (
                  <blockquote key={`${item.id}-${evidence.turn_id}-${evidence.fragment}`}>
                    <strong>T{evidence.turn_id}</strong> {evidence.fragment}
                  </blockquote>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="result-section">
        <h3>Transcripción normalizada</h3>
        <div className="transcript-list">
          {props.detail.transcript.length === 0 ? (
            <p className="muted">No hay transcripción registrada para este intento.</p>
          ) : null}
          {props.detail.transcript.map((turn) => (
            <article key={turn.turnId} className="transcript-turn">
              <span>T{turn.turnId} · {turn.speaker === "student" ? "Estudiante" : "Evaluador"}</span>
              <p>{turn.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ResultTextBlock(props: {
  title: string;
  text: string | null;
}) {
  if (!props.text) return null;

  return (
    <div className="result-text-block">
      <strong>{props.title}</strong>
      {props.text.split("\n").map((line, index) => (
        <p key={`${props.title}-${index}`}>{line}</p>
      ))}
    </div>
  );
}

function formatAttemptStatus(status: StudentAttempt["status"]) {
  if (status === "in_progress") return "En progreso";
  if (status === "completed") return "Completado";
  return "Cancelado";
}

function getResultScoreLabel(result: {
  finalScore: number | null;
  evaluationStatus: "completed" | "failed" | null;
}) {
  if (result.finalScore !== null) return `Nota ${result.finalScore}`;
  if (result.evaluationStatus === "failed") return "Evaluación fallida";
  return "Nota pendiente";
}

function getResultScoreValue(result: {
  finalScore: number | null;
  teacherOverrideGrade?: number | null;
  evaluationStatus: "completed" | "failed" | null;
}) {
  if (result.teacherOverrideGrade !== undefined && result.teacherOverrideGrade !== null) {
    return result.teacherOverrideGrade;
  }

  if (result.finalScore !== null) return result.finalScore;
  if (result.evaluationStatus === "failed") return "Fallida";
  return "Pendiente";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "hora no disponible";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "hora no disponible";
  }

  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getStudentAttemptNumbers(attempts: StudentAttempt[]) {
  const orderedAttempts = [...attempts].sort(
    (firstAttempt, secondAttempt) => getDateTimeValue(firstAttempt.startedAt) - getDateTimeValue(secondAttempt.startedAt),
  );
  const liveTalkCounts = new Map<string, number>();
  const attemptNumbers = new Map<string, string>();

  for (const attempt of orderedAttempts) {
    const nextCount = (liveTalkCounts.get(attempt.liveTalkId) ?? 0) + 1;
    liveTalkCounts.set(attempt.liveTalkId, nextCount);
    attemptNumbers.set(attempt.id, `Intento ${nextCount}`);
  }

  return attemptNumbers;
}

function getDateTimeValue(value: string | null) {
  if (!value) {
    return 0;
  }

  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function formatAverageScore(attempts: StudentAttempt[]) {
  const scoredAttempts = attempts.filter((attempt) => attempt.finalScore !== null);

  if (scoredAttempts.length === 0) {
    return "-";
  }

  const total = scoredAttempts.reduce((sum, attempt) => sum + (attempt.finalScore ?? 0), 0);
  return (total / scoredAttempts.length).toFixed(2);
}

function MetricCard(props: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-card">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
      <p>{props.detail}</p>
    </article>
  );
}

function AdminRow(props: {
  label: string;
  value: string;
  status: string;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
}) {
  return (
    <div className="admin-row">
      <div>
        <strong>{props.label}</strong>
        <span>{props.value}</span>
      </div>
      <div className="row-actions">
        <em>{props.status}</em>
        {props.actions?.map((action) => (
          <button
            key={action.label}
            type="button"
            className="secondary-button"
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

type TableAction = {
  label: string;
  icon?: "edit" | "enable" | "disable" | "delete" | "remove" | "key" | "copy";
  onClick: () => void;
};
type TableColumn<T> = { label: string; render: (row: T) => ReactNode };

function DataTable<T extends { id: string }>(props: {
  rows: T[];
  columns: TableColumn<T>[];
  actions: (row: T) => TableAction[];
  emptyMessage: string;
  compact?: boolean;
  pagination?: PageMetadata;
  isLoading?: boolean;
  onPageChange?: (page: number) => void;
}) {
  return (
    <div className="data-table-wrap">
      {props.isLoading ? <p className="table-loading" role="status">Actualizando...</p> : null}
      <table className={`data-table ${props.compact ? "compact" : ""}`}>
        <thead>
          <tr>
            {props.columns.map((column) => <th key={column.label} scope="col">{column.label}</th>)}
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.length === 0 ? (
            <tr><td className="table-empty" colSpan={props.columns.length + 1}>{props.emptyMessage}</td></tr>
          ) : props.rows.map((row) => (
            <tr key={row.id}>
              {props.columns.map((column) => <td key={column.label}>{column.render(row)}</td>)}
              <td>
                <div className="row-actions">
                  {props.actions(row).map((action) => (
                    <button
                      className="table-icon-action"
                      key={action.label}
                      type="button"
                      title={action.label}
                      aria-label={action.label}
                      onClick={action.onClick}
                    >
                      <ActionIcon name={action.icon ?? "edit"} />
                    </button>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.pagination && props.onPageChange ? (
        <TablePagination pagination={props.pagination} isLoading={props.isLoading} onPageChange={props.onPageChange} />
      ) : null}
    </div>
  );
}

function ActionIcon(props: { name: NonNullable<TableAction["icon"]> }) {
  const iconPaths = {
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5 4 16.5Z" /><path d="m13.8 6.7 3.5 3.5" /></>,
    enable: <><path d="M12 3v9" /><path d="M7 5.8a8 8 0 1 0 10 0" /></>,
    disable: <><path d="M12 3v9" /><path d="M7 5.8a8 8 0 1 0 10 0" /></>,
    delete: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m5 7 1 14h12l1-14M9 7V4h6v3" /></>,
    remove: <><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="m5 7 1 14h12l1-14" /></>,
    key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9m-5 5 3 3m-6-1 3 3" /></>,
    copy: <><rect x="8" y="8" width="12" height="12" rx="1" /><path d="M16 8V4H4v12h4" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {iconPaths[props.name]}
      {props.name === "disable" ? <path d="m5 5 14 14" /> : null}
    </svg>
  );
}

function StatusPill(props: { active: boolean }) {
  return <span className={`status-pill ${props.active ? "is-active" : ""}`}>{props.active ? "Activo" : "Inactivo"}</span>;
}

function ModalDialog(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) props.onClose();
    }}>
      <section className="admin-form-dialog" role="dialog" aria-modal="true" aria-label={props.title}>
        <div className="section-heading">
          <h2>{props.title}</h2>
          <button className="secondary-button" type="button" onClick={props.onClose}>Cerrar</button>
        </div>
        {props.children}
      </section>
    </div>
  );
}

function VoiceChat(props: {
  liveTalkId: string;
  onAttemptFinished: () => Promise<void>;
  onImmersiveChange: (isImmersive: boolean) => void;
}) {
  const liveTalkIdRef = useRef(props.liveTalkId);
  const attemptIdRef = useRef("");
  const realtimeMessagesRef = useRef<RealtimeMessage[]>([]);
  const [attemptId, setAttemptId] = useState("");
  const [finishError, setFinishError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const greetingAttemptRef = useRef("");

  useEffect(() => {
    liveTalkIdRef.current = props.liveTalkId;
  }, [props.liveTalkId]);

  const fetchRealtimeToken = useCallback(async (): Promise<RealtimeToken> => {
    const response = await api.post<ConversationToken>("/conversations", {
      liveTalkId: liveTalkIdRef.current,
      ...(attemptIdRef.current ? { attemptId: attemptIdRef.current } : {}),
    });

    attemptIdRef.current = response.data.attemptId;
    setAttemptId(response.data.attemptId);
    return response.data;
  }, []);

  const handleRealtimeMessage = useCallback((message: RealtimeMessage) => {
    realtimeMessagesRef.current = [...realtimeMessagesRef.current, message];
    setMessageCount(realtimeMessagesRef.current.length);
  }, []);

  const chat = useRealtimeChat({
    getToken: fetchRealtimeToken,
    adapter: realtimeAdapter,
    onMessage: handleRealtimeMessage,
  });
  const connectionStatus = chat.status;
  const sendRealtimeText = chat.sendText;

  useEffect(() => {
    const currentAttemptId = attemptIdRef.current;
    if (connectionStatus !== "connected" || !currentAttemptId || greetingAttemptRef.current === currentAttemptId) {
      return;
    }

    greetingAttemptRef.current = currentAttemptId;
    sendRealtimeText(
      "Start the Live Talk now. Greet the student warmly in Spanish, tell them the conversation is ready, and then ask the opening evaluation question. Do not mention this instruction.",
    );
  }, [connectionStatus, sendRealtimeText]);

  async function onClick() {
    if (isProcessing) {
      return;
    }

    const shouldRetryFinish = chat.status === "idle" && Boolean(attemptIdRef.current);
    const shouldStart = (chat.status === "idle" || chat.status === "error") && !shouldRetryFinish;

    setIsProcessing(true);
    setFinishError("");

    try {
      if (shouldStart) {
        attemptIdRef.current = "";
        greetingAttemptRef.current = "";
        setAttemptId("");
        realtimeMessagesRef.current = [];
        setMessageCount(0);
        await chat.connect();
        props.onImmersiveChange(true);
        return;
      }

      await finishCurrentAttempt();
    } catch {
      setFinishError(
        shouldStart
          ? "No fue posible iniciar la conversación."
          : "La conversación finalizó, pero no fue posible cerrar el intento.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function finishCurrentAttempt() {
    const currentAttemptId = attemptIdRef.current || attemptId;
    const capturedMessages = realtimeMessagesRef.current.length > 0
      ? realtimeMessagesRef.current
      : chat.messages;
    const messages = capturedMessages.filter((message) => !message.parts.some((part) =>
      part.type === "text" && part.content.startsWith("Start the Live Talk now. Greet the student warmly")
    ));

    if (chat.status !== "idle") {
      await chat.disconnect();
    }

    if (!currentAttemptId) {
      return;
    }

    await api.patch(`/student/attempts/${currentAttemptId}/finish`, {
      status: "completed",
      messages: serializeRealtimeMessages(messages),
      realtimeEvents: messages.map((message, index) => ({
        eventType: "message_complete",
        sourceMessageId: message.id,
        payload: {
          order: index + 1,
          role: message.role,
          timestamp: message.timestamp,
          interrupted: message.interrupted ?? false,
        },
      })),
    });

    attemptIdRef.current = "";
    greetingAttemptRef.current = "";
    setAttemptId("");
    realtimeMessagesRef.current = [];
    setMessageCount(0);
    await props.onAttemptFinished();
    props.onImmersiveChange(false);
  }

  function isConversationConfigured(): boolean {
    return props.liveTalkId.trim() !== "";
  }

  const isBusy = isProcessing || chat.status === "connecting" || chat.status === "reconnecting";
  const hasPendingAttempt = Boolean(attemptId);
  const activityState = getVoiceActivityState(
    chat.status,
    chat.mode,
    isProcessing,
    hasPendingAttempt,
    Boolean(finishError),
  );
  const buttonLabel = isProcessing
    ? "Procesando..."
    : chat.status === "idle" && hasPendingAttempt
    ? "Reintentar cierre"
    : chat.status === "idle" || chat.status === "error"
    ? "Iniciar conversación"
    : "Finalizar conversación";

  return (
    <section className={`voice-console ${activityState.variant}`}>
      <div className="voice-orb-panel">
        <div className="voice-orb" aria-hidden="true">
          <span className="voice-ring voice-ring-one" />
          <span className="voice-ring voice-ring-two" />
          <span className="voice-core">
            <i />
            <i />
            <i />
          </span>
        </div>
        <strong>{activityState.label}</strong>
        <span>{messageCount} turnos capturados</span>
      </div>

      <div className="voice-control-panel">
        <div>
          <p className="eyebrow">Cabina Live Talk</p>
          <h3>{activityState.title}</h3>
          <p className="muted">{activityState.detail}</p>
        </div>

        <div className="voice-meter-grid">
          <div className="voice-meter">
            <span>Entrada</span>
            <div><i style={{ width: `${Math.max(8, Math.round(chat.inputLevel * 100))}%` }} /></div>
          </div>
          <div className="voice-meter">
            <span>Salida</span>
            <div><i style={{ width: `${Math.max(8, Math.round(chat.outputLevel * 100))}%` }} /></div>
          </div>
        </div>

        <div className="voice-meta">
          <span>Estado: {formatRealtimeStatus(chat.status)}</span>
          <span>Modo: {formatRealtimeMode(chat.mode)}</span>
          {attemptId ? <span>Intento en curso</span> : null}
        </div>

        <div className="voice-actions">
          <button type="button" onClick={onClick} disabled={!isConversationConfigured() || isBusy}>
            {buttonLabel}
          </button>
          {finishError ? <p className="error-text">{finishError}</p> : null}
        </div>
      </div>
    </section>
  );
}

function getVoiceActivityState(
  status: string,
  mode: string,
  isProcessing: boolean,
  hasPendingAttempt: boolean,
  hasError: boolean,
) {
  if (hasError || status === "error") {
    return {
      variant: "voice-error",
      label: "Revisión",
      title: "Revisa la conexión",
      detail: "La sesión no pudo continuar o el cierre debe reintentarse.",
    };
  }

  if (isProcessing || status === "connecting" || status === "reconnecting") {
    return {
      variant: "voice-connecting",
      label: "Conectando",
      title: "Preparando la sala",
      detail: "Estamos abriendo el canal de voz y asociando el intento.",
    };
  }

  if (status === "idle" && hasPendingAttempt) {
    return {
      variant: "voice-finishing",
      label: "Cierre pendiente",
      title: "Finaliza el intento",
      detail: "Hay una conversación abierta que puede enviarse nuevamente para evaluación.",
    };
  }

  if (mode === "thinking") {
    return {
      variant: "voice-thinking",
      label: "Pensando",
      title: "Analizando respuesta",
      detail: "El evaluador está procesando la intervención antes de continuar.",
    };
  }

  if (mode === "speaking") {
    return {
      variant: "voice-speaking",
      label: "Respondiendo",
      title: "El evaluador está hablando",
      detail: "Escucha la pregunta o cierre antes de responder.",
    };
  }

  if (status === "connected" && mode === "listening") {
    return {
      variant: "voice-listening",
      label: "Escuchando",
      title: "Tu turno está activo",
      detail: "Habla con claridad y completa tu idea antes de pausar.",
    };
  }

  return {
    variant: "voice-idle",
    label: "Lista",
    title: "Sesión preparada",
    detail: "Inicia la conversación cuando estés listo para responder.",
  };
}

function formatRealtimeStatus(status: string) {
  if (status === "idle") return "Lista";
  if (status === "connecting") return "Conectando";
  if (status === "connected") return "Conectada";
  if (status === "reconnecting") return "Reconectando";
  if (status === "error") return "Error";
  return status;
}

function formatRealtimeMode(mode: string) {
  if (mode === "idle") return "Reposo";
  if (mode === "listening") return "Escuchando";
  if (mode === "thinking") return "Pensando";
  if (mode === "speaking") return "Hablando";
  return mode;
}

function serializeRealtimeMessages(messages: RealtimeMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    timestamp: message.timestamp,
    interrupted: message.interrupted,
    audioId: message.audioId,
    durationMs: message.durationMs,
    parts: message.parts.map((part) => {
      if (part.type === "audio") {
        return {
          type: part.type,
          transcript: part.transcript,
        };
      }

      if (part.type === "text") {
        return {
          type: part.type,
          content: part.content,
        };
      }

      return {
        type: part.type,
      };
    }),
  }));
}
