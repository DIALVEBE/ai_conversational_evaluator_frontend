import type { AdminSection, PageMetadata, ProgramOption, AdminUserFilters, AdminCatalogFilters, AdminSpaceFilters, AdminAssignmentFilters, AppUser, AdminUser, AcademicProgram, AcademicSpace, AdminSummary, AdminAssignment, ConfirmationState } from '../types';
import { ADMIN_PAGE_SIZE, EMPTY_PAGE } from '../types';
import { MetricCard } from '../components/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { AdminResultsPanel } from './admin-results';
import { AdminUsersPanel, AdminProgramsPanel, AdminSpacesPanel, AdminAssignmentsPanel, ConfirmDialog } from './admin-catalog';
import academyImage from '../assets/virtualchallenge-collage.png';

export function AdminHome(props: {
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
