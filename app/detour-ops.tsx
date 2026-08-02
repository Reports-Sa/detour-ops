"use client";

import { useEffect, useMemo, useState } from "react";
import {
  initialState,
  optionRows,
  phases,
  reportTypes,
  type CheckStatus,
  type ChecklistItem,
  type IssueRecord,
  type IssueStatus,
  type IssueType,
  type ProjectState,
  type RecordStatus,
} from "./detour-data";

type TabId =
  | "control"
  | "setup"
  | "design"
  | "assurance"
  | "records"
  | "reports"
  | "assistant";

const tabs: { id: TabId; label: string; code: string }[] = [
  { id: "control", label: "Control Board", code: "00" },
  { id: "setup", label: "Project Setup", code: "01" },
  { id: "design", label: "Detour Design", code: "02" },
  { id: "assurance", label: "Field Assurance", code: "03" },
  { id: "records", label: "Issues & Docs", code: "04" },
  { id: "reports", label: "Reports", code: "05" },
  { id: "assistant", label: "Code Assistant", code: "AI" },
];

const statusOrder: CheckStatus[] = ["Open", "Pass", "Fail", "N/A"];
const documentStatusOrder: RecordStatus[] = [
  "Draft",
  "Submitted",
  "Approved",
  "Rejected",
];

type CheckGroup = "survey" | "design" | "readiness" | "opening" | "operation" | "closeout";

const storageKey = "detourops.workspace.v2";
const workspaceIdentityKey = "detourops.workspace.identity";
const phaseGroups: CheckGroup[][] = [
  ["survey"],
  ["design"],
  ["readiness"],
  ["opening"],
  ["operation", "closeout"],
];
const phaseTabs: TabId[] = ["setup", "design", "assurance", "assurance", "assurance"];

const issueStatusOptions: Record<IssueType, IssueStatus[]> = {
  Observation: ["Open", "Contained", "Corrective Action", "Verification", "Closed"],
  NCR: ["Open", "Contained", "Corrective Action", "Verification", "Closed"],
  Incident: ["Open", "Contained", "Corrective Action", "Verification", "Closed"],
  Complaint: ["Open", "Contained", "Corrective Action", "Verification", "Closed"],
  RFI: ["Open", "Submitted", "Answered", "Closed"],
  Change: ["Proposed", "Under Review", "Approved", "Implemented", "Closed"],
};

const issueFlowLabels: Record<IssueType, string> = {
  Observation: "Contain â†’ investigate â†’ correct â†’ verify â†’ close",
  NCR: "Contain â†’ root cause â†’ correct â†’ verify â†’ close",
  Incident: "Respond â†’ investigate â†’ correct â†’ verify â†’ close",
  Complaint: "Acknowledge â†’ investigate â†’ respond â†’ verify â†’ close",
  RFI: "Open â†’ submit â†’ answer â†’ incorporate â†’ close",
  Change: "Propose â†’ review â†’ approve â†’ implement â†’ close",
};

function isMandatoryGap(item: ChecklistItem): boolean {
  if (!item.required) return false;
  if (item.status === "Open" || item.status === "Fail") return true;
  return (item.status === "Pass" || item.status === "N/A") && !item.evidence.trim();
}

function checksForPhase(state: ProjectState, phaseIndex: number): ChecklistItem[] {
  return phaseGroups[phaseIndex].flatMap((group) => state[group]);
}

function cloneInitialState(): ProjectState {
  return JSON.parse(JSON.stringify(initialState)) as ProjectState;
}

function loadInitialState(): ProjectState {
  if (typeof window === "undefined") return cloneInitialState();
  const local = window.localStorage.getItem(storageKey);
  if (!local) return cloneInitialState();
  try {
    const parsed = JSON.parse(local) as Partial<ProjectState>;
    return parsed.schemaVersion === 2 ? (parsed as ProjectState) : cloneInitialState();
  } catch {
    window.localStorage.removeItem(storageKey);
    return cloneInitialState();
  }
}

function getWorkspaceIdentity() {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(workspaceIdentityKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.localStorage.setItem(workspaceIdentityKey, created);
  return created;
}

export function DetourOps() {
  const [tab, setTab] = useState<TabId>("control");
  const [state, setState] = useState<ProjectState>(loadInitialState);
  const [workspaceId, setWorkspaceId] = useState("");
  const [saveState, setSaveState] = useState("Browser workspace");
  const [lastSaved, setLastSaved] = useState("Not synced");
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    const identity = getWorkspaceIdentity();
    setWorkspaceId(identity);
    void fetch("/api/workspace", {
      headers: { "x-detourops-workspace": identity },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.workspace?.state?.schemaVersion === 2) {
          setState(data.workspace.state as ProjectState);
          setSaveState("Isolated cloud workspace");
          setLastSaved(`Revision ${data.workspace.revision}`);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const allChecks = useMemo(
    () => [
      ...state.survey,
      ...state.design,
      ...state.readiness,
      ...state.opening,
      ...state.operation,
      ...state.closeout,
    ],
    [state],
  );
  const passed = allChecks.filter((item) => item.status === "Pass").length;
  const failed = allChecks.filter((item) => item.status === "Fail").length;
  const currentPhase = Math.min(Math.max(state.workflow.currentPhase, 0), phases.length - 1);
  const phaseChecks = phaseGroups.map((_, index) => checksForPhase(state, index));
  const currentGateBlockers = phaseChecks
    .slice(0, currentPhase + 1)
    .flat()
    .filter(isMandatoryGap);
  const futureMandatoryControls = phaseChecks
    .slice(currentPhase + 1)
    .flat()
    .filter(isMandatoryGap);
  const criticalIssues = state.issues.filter(
    (issue) =>
      issue.status !== "Closed" &&
      (issue.severity === "Critical" || issue.severity === "High"),
  ).length;

  function updateProject(field: keyof ProjectState["project"], value: string) {
    setState((current) => ({
      ...current,
      project: { ...current.project, [field]: value },
    }));
  }

  function updateTraffic(field: keyof ProjectState["traffic"], value: string) {
    setState((current) => ({
      ...current,
      traffic: { ...current.traffic, [field]: value },
    }));
  }

  function updateChecklist(
    group: CheckGroup,
    id: string,
    patch: Partial<ChecklistItem>,
  ) {
    setState((current) => ({
      ...current,
      [group]: current[group].map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    }));
  }

  function updateCurrentPhase(value: number) {
    setState((current) => ({
      ...current,
      workflow: { ...current.workflow, currentPhase: value },
    }));
  }

  async function saveWorkspace() {
    const identity = workspaceId || getWorkspaceIdentity();
    setSaveState("Savingâ€¦");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-detourops-workspace": identity,
        },
        body: JSON.stringify({
          projectCode: state.project.code,
          projectTitle: state.project.title,
          state,
        }),
      });
      if (response.status === 401) {
        setSaveState("Saved locally آ· sign in for cloud");
        setLastSaved(new Date().toLocaleTimeString());
        return;
      }
      const result = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Save failed");
      setSaveState("Isolated cloud saved");
      setLastSaved(`Revision ${result.revision ?? "â€”"}`);
    } catch {
      setSaveState("Saved locally آ· cloud unavailable");
      setLastSaved(new Date().toLocaleTimeString());
    }
  }

  function resetDemo() {
    if (!window.confirm("Reset this browser workspace to the DetourOps demo?")) return;
    setState(cloneInitialState());
    setSaveState("Demo reset");
    setLastSaved("Not synced");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="mobile-rail-toggle"
          onClick={() => setRailOpen((open) => !open)}
          aria-label="Toggle navigation"
          aria-expanded={railOpen}
        >
          MENU
        </button>
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <span>D</span>
            <span>O</span>
          </div>
          <div>
            <p className="eyebrow">Traffic diversion control system</p>
            <h1>DETOUR<span>OPS</span></h1>
          </div>
        </div>
        <div className="topbar-project">
          <span className="micro-label">ACTIVE PROJECT</span>
          <strong>{state.project.code}</strong>
          <span>{state.project.road}</span>
        </div>
        <div className="topbar-actions">
          <div className="save-readout">
            <span>{saveState}</span>
            <small>{lastSaved}</small>
          </div>
          <button className="button ghost" onClick={resetDemo}>Reset demo</button>
          <button className="button primary" onClick={() => void saveWorkspace()}>
            Save workspace
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className={`side-rail ${railOpen ? "open" : ""}`}>
          <div className="route-origin">
            <span className="route-dot start" />
            <div>
              <small>ORIGIN</small>
              <strong>Project need</strong>
            </div>
          </div>

          <nav aria-label="DetourOps modules">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={tab === item.id ? "nav-item active" : "nav-item"}
                onClick={() => {
                  setTab(item.id);
                  setRailOpen(false);
                }}
              >
                <span className="nav-code">{item.code}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="route-destination">
            <span className="route-dot end" />
            <div>
              <small>DESTINATION</small>
              <strong>Normal traffic</strong>
            </div>
          </div>

          <div className="demo-notice">
            <span>DEMO DATA</span>
            <p>Replace all sample values with verified project records before use.</p>
          </div>
        </aside>

        <main className="main-stage">
          <div className="status-strip">
            <div>
              <span className="pulse-dot" />
              <strong>Gate {currentPhase + 1} / 5</strong>
              <span>{phases[currentPhase].name}</span>
            </div>
            <div className="strip-metrics">
              <span><b>{passed}</b> passed</span>
              <span className={failed ? "danger-text" : ""}><b>{failed}</b> failed</span>
              <span className={currentGateBlockers.length ? "danger-text" : ""}><b>{currentGateBlockers.length}</b> current-gate blockers</span>
              <span><b>{futureMandatoryControls.length}</b> future controls</span>
              <span><b>{criticalIssues}</b> high-priority issues</span>
            </div>
          </div>

          {tab === "control" && (
            <ControlBoard
              state={state}
              currentPhase={currentPhase}
              currentGateBlockers={currentGateBlockers}
              futureMandatoryControls={futureMandatoryControls}
              criticalIssues={criticalIssues}
              onNavigate={setTab}
              onPhaseChange={updateCurrentPhase}
            />
          )}
          {tab === "setup" && (
            <ProjectSetup
              state={state}
              updateProject={updateProject}
              updateTraffic={updateTraffic}
              updateChecklist={updateChecklist}
            />
          )}
          {tab === "design" && <DetourDesign state={state} updateChecklist={updateChecklist} />}
          {tab === "assurance" && (
            <FieldAssurance state={state} updateChecklist={updateChecklist} />
          )}
          {tab === "records" && (
            <Records
              state={state}
              setState={setState}
            />
          )}
          {tab === "reports" && <Reports state={state} setState={setState} />}
          {tab === "assistant" && <CodeAssistant />}
        </main>
      </div>
    </div>
  );
}

function SectionHead({
  code,
  title,
  description,
  action,
}: {
  code: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div className="section-code">{code}</div>
      <div>
        <p className="eyebrow">From project need to normal traffic</p>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action && <div className="section-action">{action}</div>}
    </div>
  );
}

function ControlBoard({
  state,
  currentPhase,
  currentGateBlockers,
  futureMandatoryControls,
  criticalIssues,
  onNavigate,
  onPhaseChange,
}: {
  state: ProjectState;
  currentPhase: number;
  currentGateBlockers: ChecklistItem[];
  futureMandatoryControls: ChecklistItem[];
  criticalIssues: number;
  onNavigate: (tab: TabId) => void;
  onPhaseChange: (phase: number) => void;
}) {
  const activePhase = phases[currentPhase];
  const gateIsBlocked = currentGateBlockers.length > 0;
  const currentPhaseChecks = checksForPhase(state, currentPhase);
  const signalItems = (gateIsBlocked ? currentGateBlockers : currentPhaseChecks).slice(0, 3);
  const issueActions = state.issues
    .filter((issue) => issue.status !== "Closed")
    .map((issue) => ({
      owner: issue.owner,
      task: issue.title,
      due: issue.due,
      type: issue.type,
    }));
  const blockerActions = currentGateBlockers.map((item) => ({
    owner: item.owner,
    task: item.label,
    due: "GATE",
    type: "HOLD",
  }));
  const nextActions = [...blockerActions, ...issueActions].slice(0, 4);

  return (
    <div className="page-stack">
      <SectionHead
        code="00"
        title="Operational Control Board"
        description="One place to see the current gate, evidence gaps, next actions, and the exact reason the detour cannot advance."
        action={
          <div className="control-head-actions">
            <label className="gate-selector">
              <span>ACTIVE GATE</span>
              <select value={currentPhase} onChange={(event) => onPhaseChange(Number(event.target.value))}>
                {phases.map((phase, index) => <option key={phase.key} value={index}>Gate {index + 1} آ· {phase.name}</option>)}
              </select>
            </label>
            <button className="button dark" onClick={() => window.print()}>Print shift board</button>
          </div>
        }
      />

      <section className="hero-board">
        <div className="hero-copy">
          <span className="gate-tag">CURRENT CONTROL POINT</span>
          <h3>{gateIsBlocked ? activePhase.holdLine : activePhase.readyLine}</h3>
          <p>
            {gateIsBlocked
              ? `${currentGateBlockers.length} mandatory controls due at or before Gate ${currentPhase + 1} remain unresolved. Close and verify them before the gate is signed.`
              : `All mandatory controls due at or before Gate ${currentPhase + 1} are supported by evidence. Obtain the authorized review and signature before advancing.`}
            {futureMandatoryControls.length > 0 && ` ${futureMandatoryControls.length} future controls are tracked separately and are not release blockers yet.`}
          </p>
          <div className="hero-actions">
            <button className="button warning" onClick={() => onNavigate(phaseTabs[currentPhase])}>Open Evidence Gate</button>
            <button className="button ghost-light" onClick={() => onNavigate("records")}>Review issues</button>
          </div>
        </div>
        <div className="hero-signal" aria-label={`${currentGateBlockers.length} current-gate blockers and ${futureMandatoryControls.length} future mandatory controls`}>
          <div className="signal-cluster">
            <div className={gateIsBlocked ? "signal-ring" : "signal-ring ready"}>
              <strong>{currentGateBlockers.length}</strong>
              <span>CURRENT GATE</span>
            </div>
            <div className="future-counter">
              <strong>{futureMandatoryControls.length}</strong>
              <span>FUTURE CONTROLS</span>
            </div>
          </div>
          <dl>
            {signalItems.map((item) => {
              const evidenceMissing = (item.status === "Pass" || item.status === "N/A") && !item.evidence.trim();
              const tone = item.status === "Fail" ? "bad" : item.status === "Pass" && !evidenceMissing ? "good" : "warn";
              return <div key={item.id}><dt>{item.label}</dt><dd className={tone}>{evidenceMissing ? "Evidence missing" : item.status}</dd></div>;
            })}
          </dl>
        </div>
      </section>

      <section className="phase-road" aria-label="Project lifecycle">
        {phases.map((phase, index) => {
          const phaseBlockers = checksForPhase(state, index).filter(isMandatoryGap).length;
          const stateClass = index < currentPhase
            ? phaseBlockers > 0 ? "attention" : "complete"
            : index === currentPhase ? "current" : "future";
          const gateLabel = index < currentPhase
            ? phaseBlockers > 0 ? `${phaseBlockers} CARRY-OVER BLOCKERS` : "GATE PASSED"
            : index === currentPhase
              ? phaseBlockers > 0 ? `${phaseBlockers} GATE BLOCKERS` : "READY FOR SIGNATURE"
              : `${phaseBlockers} FUTURE CONTROLS`;
          return (
            <article className={`phase-card ${stateClass}`} key={phase.key}>
              <div className="phase-key">{phase.key}</div>
              <div className="phase-content">
                <small>PHASE {index + 1}</small>
                <h3>{phase.name}</h3>
                <p>{phase.short}</p>
                <ul>
                  {phase.steps.map((step) => <li key={step}>{step}</li>)}
                </ul>
              </div>
              <div className="phase-gate">
                <span>{gateLabel}</span>
                <strong>{phase.gate}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="metric-grid five">
        <article className="metric-card red">
          <span>RELEASE CONTROL</span>
          <strong>{currentGateBlockers.length}</strong>
          <p>current-gate blockers that prevent release now</p>
          <button onClick={() => onNavigate(phaseTabs[currentPhase])}>Close current blockers â†’</button>
        </article>
        <article className="metric-card amber">
          <span>FORWARD CONTROL</span>
          <strong>{futureMandatoryControls.length}</strong>
          <p>mandatory controls tracked for later gates</p>
          <button onClick={() => onNavigate("assurance")}>Review future controls â†’</button>
        </article>
        <article className="metric-card navy">
          <span>RISK CONTROL</span>
          <strong>{criticalIssues}</strong>
          <p>high-priority records not yet closed</p>
          <button onClick={() => onNavigate("records")}>Open issue register â†’</button>
        </article>
        <article className="metric-card green">
          <span>DOCUMENT CONTROL</span>
          <strong>{state.documents.filter((doc) => doc.status === "Approved").length}/{state.documents.length}</strong>
          <p>controlled documents approved</p>
          <button onClick={() => onNavigate("records")}>Review register â†’</button>
        </article>
        <article className="metric-card teal">
          <span>CODE CONTROL</sp…5909 tokens truncated…tType, setReportType] = useState(reportTypes[0]);
  const reportFields: { key: keyof ProjectState["report"]; label: string; short?: boolean }[] = [
    { key: "date", label: "Report date", short: true },
    { key: "shift", label: "Shift / inspection window", short: true },
    { key: "weather", label: "Weather / surface condition", short: true },
    { key: "trafficCondition", label: "Traffic condition and queues" },
    { key: "worksCompleted", label: "Works completed" },
    { key: "inspections", label: "Inspections, defects and actions" },
    { key: "incidents", label: "Incidents, near misses or complaints" },
    { key: "nextShift", label: "Next-shift priorities and handover" },
  ];

  function updateReport(key: keyof ProjectState["report"], value: string) {
    setState((current) => ({
      ...current,
      report: { ...current.report, [key]: value },
    }));
  }

  return (
    <div className="page-stack report-page">
      <SectionHead
        code="05"
        title="Reports & Handover"
        description="Generate a concise operational record from the same project data. Separate observed facts, engineering assessment, action, owner, and closure evidence."
        action={<button className="button dark" onClick={() => window.print()}>Print / save PDF</button>}
      />

      <section className="report-picker">
        <label><span>REPORT TYPE</span><select value={reportType} onChange={(event) => setReportType(event.target.value)}>{reportTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <div><span>PROJECT</span><strong>{state.project.code} آ· {state.project.title}</strong></div>
        <div><span>CONTROLLED DRAWING</span><strong>{state.project.drawing}</strong></div>
      </section>

      <section className="report-sheet">
        <header>
          <div><span className="report-logo">DO</span><div><small>DETOUR OPERATIONS RECORD</small><h3>{reportType}</h3></div></div>
          <div><small>REPORT STATUS</small><strong>DRAFT</strong></div>
        </header>
        <div className="report-meta">
          <div><span>Project</span><b>{state.project.code}</b></div>
          <div><span>Road / location</span><b>{state.project.road} آ· {state.project.chainage}</b></div>
          <div><span>Authority</span><b>{state.project.authority}</b></div>
          <div><span>TDP / TMP</span><b>{state.project.drawing}</b></div>
        </div>
        <div className="report-form">
          {reportFields.map((field) => (
            <label className={field.short ? "report-field short" : "report-field"} key={field.key}>
              <span>{field.label}</span>
              {field.short ? <input value={state.report[field.key]} onChange={(event) => updateReport(field.key, event.target.value)} /> : <textarea rows={3} value={state.report[field.key]} onChange={(event) => updateReport(field.key, event.target.value)} />}
            </label>
          ))}
        </div>
        <div className="report-signatures">
          <div><span>Prepared by</span><strong>Traffic Engineer</strong><i>Signature / date</i></div>
          <div><span>Reviewed by</span><strong>Construction / HSE</strong><i>Signature / date</i></div>
          <div><span>Accepted by</span><strong>Consultant / Authority</strong><i>Signature / date</i></div>
        </div>
      </section>
    </div>
  );
}

type AgentStatus = {
  ready: boolean;
  source: string;
  edition: string;
  model: string;
};

type AgentExchange = {
  id: string;
  question: string;
  answer: string;
  abstained: boolean;
  citations: Array<{ fileId?: string; filename: string }>;
  evidence: Array<{ filename: string; excerpt: string; score?: number }>;
};

type CorpusSource = {
  id: string;
  filename: string;
  title: string;
  authority: string;
  edition: string;
  status: "uploading" | "indexing" | "ready" | "failed";
  uploadedAt: string;
  indexedAt?: string;
  error?: string;
};

function CodeAssistant() {
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState<AgentStatus>({
    ready: false,
    source: "Saudi Highway Code 305",
    edition: "Checking configured corpusâ€¦",
    model: "Source-controlled model",
  });
  const [exchanges, setExchanges] = useState<AgentExchange[]>([]);
  const [sources, setSources] = useState<CorpusSource[]>([]);
  const [uploadState, setUploadState] = useState("Administrator access required to change the corpus");
  const [adminKey, setAdminKey] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceAuthority, setSourceAuthority] = useState("Roads General Authority â€” Saudi Arabia");
  const [sourceEdition, setSourceEdition] = useState("Uploaded reference â€” revision to be verified");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAdminKey = window.sessionStorage.getItem("detourops.corpus.admin");
    if (storedAdminKey) setAdminKey(storedAdminKey);

    void fetch("/api/assistant", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Assistant status unavailable");
        return response.json() as Promise<AgentStatus>;
      })
      .then(setStatus)
      .catch(() => setStatus((current) => ({
        ...current,
        ready: false,
        edition: "Server configuration required",
      })));

    const refreshCorpus = () => {
      void fetch("/api/corpus", { headers: { accept: "application/json" } })
        .then((response) => response.ok ? response.json() : null)
        .then((result) => {
          if (result?.sources) setSources(result.sources as CorpusSource[]);
        })
        .catch(() => undefined);
    };
    refreshCorpus();
    const interval = window.setInterval(refreshCorpus, 5_000);
    return () => window.clearInterval(interval);
  }, []);

  function corpusAdminKey() {
    const provided = adminKey.trim();
    if (provided) window.sessionStorage.setItem("detourops.corpus.admin", provided);
    return provided;
  }

  async function refreshCorpusNow() {
    const response = await fetch("/api/corpus", { headers: { accept: "application/json" } });
    if (!response.ok) return;
    const result = await response.json() as { sources?: CorpusSource[] };
    setSources(result.sources ?? []);
  }

  async function uploadSources(files?: FileList | null) {
    if (!files?.length) return;
    const adminKey = corpusAdminKey();
    if (!adminKey) {
      setUploadState("Enter the corpus administrator key before selecting source files.");
      return;
    }

    try {
      for (const file of Array.from(files)) {
        const title = sourceTitle.trim() || file.name.replace(/\.[^.]+$/, "");
        const authority = sourceAuthority.trim() || "Authority to be verified";
        const edition = sourceEdition.trim() || "Revision to be verified";
        setUploadState(`Preparing ${file.name}â€¦`);

        const initResponse = await fetch("/api/corpus?action=init", {
          method: "POST",
          headers: { "content-type": "application/json", "x-corpus-admin-key": adminKey },
          body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size, title, authority, edition }),
        });
        const initResult = await initResponse.json() as { uploadId?: string; chunkSize?: number; expectedChunks?: number; error?: string };
        if (!initResponse.ok || !initResult.uploadId || !initResult.chunkSize) {
          throw new Error(initResult.error || "Could not start the source upload.");
        }

        const totalChunks = initResult.expectedChunks ?? Math.ceil(file.size / initResult.chunkSize);
        for (let index = 0; index < totalChunks; index += 1) {
          const start = index * initResult.chunkSize;
          const chunk = file.slice(start, Math.min(start + initResult.chunkSize, file.size));
          setUploadState(`Uploading ${file.name} آ· ${index + 1}/${totalChunks}`);
          const chunkResponse = await fetch(`/api/corpus?action=chunk&uploadId=${encodeURIComponent(initResult.uploadId)}&index=${index}`, {
            method: "POST",
            headers: { "content-type": "application/octet-stream", "x-corpus-admin-key": adminKey },
            body: chunk,
          });
          if (!chunkResponse.ok) {
            const chunkError = await chunkResponse.json().catch(() => ({})) as { error?: string };
            throw new Error(chunkError.error || `Chunk ${index + 1} could not be uploaded.`);
          }
        }

        setUploadState(`Queuing ${file.name} for private indexingâ€¦`);
        const completeResponse = await fetch("/api/corpus?action=complete", {
          method: "POST",
          headers: { "content-type": "application/json", "x-corpus-admin-key": adminKey },
          body: JSON.stringify({ uploadId: initResult.uploadId }),
        });
        const completeResult = await completeResponse.json() as { error?: string };
        if (!completeResponse.ok) throw new Error(completeResult.error || "Could not queue indexing.");
      }
      setUploadState("Upload complete آ· indexing continues securely in the background");
      await refreshCorpusNow();
    } catch (caught) {
      setUploadState(caught instanceof Error ? caught.message : "Source upload failed.");
    }
  }

  async function removeSource(source: CorpusSource) {
    if (!window.confirm(`Remove ${source.title} from the searchable corpus?`)) return;
    const adminKey = corpusAdminKey();
    if (!adminKey) return;
    const response = await fetch(`/api/corpus?id=${encodeURIComponent(source.id)}`, {
      method: "DELETE",
      headers: { "x-corpus-admin-key": adminKey },
    });
    const result = await response.json() as { error?: string };
    if (!response.ok) {
      setUploadState(result.error || "Source could not be removed.");
      return;
    }
    setUploadState(`${source.title} removed from the corpus`);
    await refreshCorpusNow();
  }

  async function askSourceOnly(event: React.FormEvent) {
    event.preventDefault();
    const submittedQuestion = question.trim();
    if (!submittedQuestion || asking) return;
    setAsking(true);
    setError("");

    try {
      const history = exchanges.flatMap((exchange) => [
        { role: "user", content: exchange.question },
        { role: "assistant", content: exchange.answer },
      ]);
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: submittedQuestion, history }),
      });
      const result = await response.json() as Omit<AgentExchange, "id" | "question"> & { error?: string };
      if (!response.ok) throw new Error(result.error || "The assistant could not complete the request.");

      setExchanges((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          question: submittedQuestion,
          answer: result.answer,
          abstained: result.abstained,
          citations: result.citations ?? [],
          evidence: result.evidence ?? [],
        },
      ]);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The assistant is temporarily unavailable.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="page-stack assistant-page">
      <SectionHead
        code="AI"
        title="Source-Controlled Code Assistant"
        description="A live RAG workspace for querying the Saudi Highway Code and approved project documentsâ€”restricted to indexed evidence and designed to abstain when support is insufficient."
        action={<span className={status.ready ? "live-rag-chip" : "offline-chip"}>{status.ready ? "LIVE RAG آ· SOURCE CONTROLLED" : "CONFIGURATION REQUIRED"}</span>}
      />

      <section className="assistant-grid">
        <article className="source-vault">
          <div className="vault-head"><div><span className="micro-label">APPROVED CORPUS</span><h3>Source vault</h3></div><span>{sources.filter((source) => source.status === "ready").length} LIVE / {sources.length} TOTAL</span></div>
          <div className="corpus-source-list">
            {sources.map((source) => (
              <div className={`source-row ${source.status === "ready" ? "indexed" : "pending"}`} key={source.id}>
                <div className="file-mark">{source.filename.split(".").pop()?.slice(0, 4).toUpperCase() || "DOC"}</div>
                <div>
                  <strong>{source.title}</strong>
                  <small>{source.authority} آ· {source.edition}</small>
                  {source.error && <small className="source-error">{source.error}</small>}
                </div>
                <div className="source-actions">
                  <span>{source.status.toUpperCase()}</span>
                  <button type="button" onClick={() => void removeSource(source)} aria-label={`Remove ${source.title}`}>أ—</button>
                </div>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="source-row empty">
                <div className="file-mark">PDF</div><div><strong>No indexed sources yet</strong><small>Add the first controlled Saudi guide below</small></div><span>EMPTY</span>
              </div>
            )}
          </div>
          <div className="corpus-upload-form">
            <label className="admin-key-field">
              <span>Corpus administrator key</span>
              <input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} autoComplete="current-password" placeholder="Required only to manage sources" />
            </label>
            <label><span>Document title</span><input value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} placeholder="Defaults to the selected file name" /></label>
            <label><span>Issuing authority</span><input value={sourceAuthority} onChange={(event) => setSourceAuthority(event.target.value)} /></label>
            <label><span>Edition / revision</span><input value={sourceEdition} onChange={(event) => setSourceEdition(event.target.value)} /></label>
          </div>
          <label className="upload-source">
            <span>{adminKey.trim() ? "+ Add controlled source files" : "Enter administrator key to enable upload"}</span>
            <input type="file" multiple disabled={!adminKey.trim()} accept=".pdf,.docx,.txt,.md,.pptx,.html" onChange={(event) => void uploadSources(event.target.files)} />
          </label>
          <p className="upload-state">{uploadState}</p>
          <div className="managed-source"><span>CHUNKED PRIVATE INGESTION</span><p>Large guides are uploaded in protected chunks, indexed in the background, and added to the same searchable vector store. Only a corpus administrator can add or remove files.</p></div>
          <div className="corpus-rules">
            <h4>Corpus admission rule</h4>
            <ul>
              <li>Approved edition and issuing authority verified</li>
              <li>Revision, effective date and superseded status recorded</li>
              <li>Project-specific documents separated from general code</li>
              <li>Access is private and audit events are retained</li>
            </ul>
          </div>
        </article>

        <article className="chat-console">
          <header>
            <div><span className="ai-signal">AI</span><div><strong>Code Query</strong><small>{status.model} آ· source-only policy آ· citations required</small></div></div>
            <span className={status.ready ? "locked-status live" : "locked-status"}>{status.ready ? "READY" : "LOCKED"}</span>
          </header>
          <div className="chat-body">
            <div className="system-message">
              <span>ANSWER POLICY</span>
              <p>Use only retrieved passages from approved sources. Cite source, edition, section and page. If evidence is absent or conflicting, abstain and escalate.</p>
            </div>
            <div className="suggested-questions">
              <span>TRY A CONTROLLED QUERY:</span>
              {["What controls apply to a lane closure at this speed?", "Where does the code define taper length?", "What must be checked before opening the detour?"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}
            </div>
            <div className="agent-thread" aria-live="polite">
              {exchanges.map((exchange) => (
                <div className="agent-exchange" key={exchange.id}>
                  <div className="user-question"><span>ENGINEER</span><p>{exchange.question}</p></div>
                  <div className={`assistant-answer ${exchange.abstained ? "abstained" : ""}`}>
                    <span>{exchange.abstained ? "DETOUROPS آ· ABSTAINED" : "DETOUROPS آ· EVIDENCE-LED"}</span>
                    <p>{exchange.answer}</p>
                    <div className="citation-strip">
                      {exchange.citations.map((citation) => <b key={`${citation.fileId}-${citation.filename}`}>{citation.filename}</b>)}
                    </div>
                    {exchange.evidence.length > 0 && (
                      <details className="retrieval-evidence">
                        <summary>Inspect retrieved evidence ({exchange.evidence.length})</summary>
                        {exchange.evidence.map((item, index) => (
                          <div key={`${item.filename}-${index}`}>
                            <strong>{item.filename}</strong>
                            <p>{item.excerpt}</p>
                          </div>
                        ))}
                      </details>
                    )}
                    <small>{exchange.citations.length > 0 ? `${exchange.citations.length} cited source${exchange.citations.length > 1 ? "s" : ""}` : "No citation آ· no engineering answer"}</small>
                  </div>
                </div>
              ))}
              {asking && <div className="agent-thinking"><i /><span>Retrieving approved passages and checking citationsâ€¦</span></div>}
              {error && <div className="agent-error"><strong>QUERY NOT COMPLETED</strong><p>{error}</p></div>}
            </div>
          </div>
          <form className="chat-input" onSubmit={askSourceOnly}>
            <input value={question} maxLength={1500} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask an approved-source questionâ€¦" disabled={!status.ready || asking} />
            <button type="submit" disabled={!status.ready || asking || !question.trim()}>{asking ? "Checkingâ€¦" : "Ask sources"}</button>
          </form>
        </article>
      </section>

      <section className="rag-contract">
        <div className="contract-head"><span className="micro-label">IMPLEMENTATION CONTRACT</span><h3>How a trustworthy answer is produced</h3></div>
        <div className="rag-flow">
          <div><span>01</span><strong>Ingest</strong><small>Approved files + metadata</small></div><i>â†’</i>
          <div><span>02</span><strong>Retrieve</strong><small>Relevant source passages</small></div><i>â†’</i>
          <div><span>03</span><strong>Answer</strong><small>Only from retrieved context</small></div><i>â†’</i>
          <div><span>04</span><strong>Cite</strong><small>Source + section + page</small></div><i>â†’</i>
          <div><span>05</span><strong>Abstain</strong><small>If evidence is insufficient</small></div>
        </div>
        <div className="contract-warning">
          <strong>Engineering boundary</strong>
          <p>The assistant supports retrieval; it does not approve a design. The engineer still checks contract documents, authority requirements, site conditions, revision status, and obtains formal approval.</p>
        </div>
      </section>
    </div>
  );
}
