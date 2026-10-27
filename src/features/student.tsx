import type { AppUser, StudentLiveTalk, StudentAttempt, StudentAttemptDetail } from '../types';
import { MetricCard } from '../components/shared';
import { getApiErrorMessage } from '../lib/errors';
import { formatAttemptStatus, formatAverageScore, formatDateTime, getResultScoreLabel, getResultScoreValue, getStudentAttemptNumbers } from '../lib/result-formatters';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { VoiceChat } from './voice-chat';
import sessionImage from '../assets/virtualchallenge-session.png';

export function StudentHome(props: {
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

export function ResultTextBlock(props: {
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

