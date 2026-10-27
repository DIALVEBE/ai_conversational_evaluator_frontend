import type { AppRole, PageMetadata, ProgramOption, AdminUserFilters, AdminCatalogFilters, AdminSpaceFilters, AdminAssignmentFilters, AdminUser, AcademicProgram, AcademicSpace, AdminAssignment, ConfirmationState } from '../types';
import { DataTable, ActionIcon, StatusPill, ModalDialog } from '../components/shared';
import { getApiErrorMessage } from '../lib/errors';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { AdminUserPicker, AdminSpacePicker } from './admin-results';

export function AdminUsersPanel(props: {
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

export function AdminProgramsPanel(props: {
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

export function AdminSpacesPanel(props: {
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

export function AdminAssignmentsPanel(props: {
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

export function ConfirmDialog(props: {
  confirmation: NonNullable<ConfirmationState>;
  onClose: () => void;
}
) {
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
