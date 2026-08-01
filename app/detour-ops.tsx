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
  Observation: "Contain → investigate → correct → verify → close",
  NCR: "Contain → root cause → correct → verify → close",
  Incident: "Respond → investigate → correct → verify → close",
  Complaint: "Acknowledge → investigate → respond → verify → close",
  RFI: "Open → submit → answer → incorporate → close",
  Change: "Propose → review → approve → implement → close",
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

export function DetourOps() {
  const [tab, setTab] = useState<TabId>("control");
  const [state, setState] = useState<ProjectState>(loadInitialState);
  const [saveState, setSaveState] = useState("Local demo");
  const [lastSaved, setLastSaved] = useState("Not synced");
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/workspace")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.workspace?.state?.schemaVersion === 2) {
          setState(data.workspace.state as ProjectState);
          setSaveState("Private cloud workspace");
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
    setSaveState("Saving…");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectCode: state.project.code,
          projectTitle: state.project.title,
          state,
        }),
      });
      if (response.status === 401) {
        setSaveState("Saved locally · sign in for cloud");
        setLastSaved(new Date().toLocaleTimeString());
        return;
      }
      const result = (await response.json()) as { revision?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Save failed");
      setSaveState("Private cloud saved");
      setLastSaved(`Revision ${result.revision ?? "—"}`);
    } catch {
      setSaveState("Saved locally · cloud unavailable");
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
                {phases.map((phase, index) => <option key={phase.key} value={index}>Gate {index + 1} · {phase.name}</option>)}
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
          <button onClick={() => onNavigate(phaseTabs[currentPhase])}>Close current blockers →</button>
        </article>
        <article className="metric-card amber">
          <span>FORWARD CONTROL</span>
          <strong>{futureMandatoryControls.length}</strong>
          <p>mandatory controls tracked for later gates</p>
          <button onClick={() => onNavigate("assurance")}>Review future controls →</button>
        </article>
        <article className="metric-card navy">
          <span>RISK CONTROL</span>
          <strong>{criticalIssues}</strong>
          <p>high-priority records not yet closed</p>
          <button onClick={() => onNavigate("records")}>Open issue register →</button>
        </article>
        <article className="metric-card green">
          <span>DOCUMENT CONTROL</span>
          <strong>{state.documents.filter((doc) => doc.status === "Approved").length}/{state.documents.length}</strong>
          <p>controlled documents approved</p>
          <button onClick={() => onNavigate("records")}>Review register →</button>
        </article>
        <article className="metric-card teal">
          <span>CODE CONTROL</span>
          <strong>0</strong>
          <p>sources indexed; answers remain locked</p>
          <button onClick={() => onNavigate("assistant")}>Configure sources →</button>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel next-actions">
          <div className="panel-heading">
            <div><span className="micro-label">OWNER-DRIVEN</span><h3>Next 4 actions</h3></div>
            <span className="live-chip">LIVE BOARD</span>
          </div>
          {nextActions.map((action, index) => (
            <div className="action-row" key={action.task}>
              <span className="action-number">{String(index + 1).padStart(2, "0")}</span>
              <div><strong>{action.task}</strong><small>{action.owner}</small></div>
              <span className="action-type">{action.type}</span>
              <time>{action.due}</time>
            </div>
          ))}
          {nextActions.length === 0 && <div className="empty-actions">No current-gate actions remain. Prepare the authorized gate review.</div>}
        </article>

        <article className="panel decision-card">
          <div className="panel-heading">
            <div><span className="micro-label">EVIDENCE GATE</span><h3>Release decision</h3></div>
          </div>
          <div className={gateIsBlocked ? "decision-stamp" : "decision-stamp ready"}>{gateIsBlocked ? "HOLD" : "READY"}</div>
          <p>{gateIsBlocked
            ? "Release only when every current or carry-over mandatory control is compliant and supported by evidence."
            : "The evidence pack is ready for review. Only the authorized signatory can release the gate."}</p>
          <div className="signature-line"><span>Prepared by</span><b>Traffic Engineer</b></div>
          <div className="signature-line"><span>Verified by</span><b>Consultant / Authority</b></div>
        </article>
      </section>
    </div>
  );
}

function ProjectSetup({
  state,
  updateProject,
  updateTraffic,
  updateChecklist,
}: {
  state: ProjectState;
  updateProject: (field: keyof ProjectState["project"], value: string) => void;
  updateTraffic: (field: keyof ProjectState["traffic"], value: string) => void;
  updateChecklist: (
    group: "survey" | "readiness" | "opening" | "operation" | "closeout",
    id: string,
    patch: Partial<ChecklistItem>,
  ) => void;
}) {
  const projectFields: { key: keyof ProjectState["project"]; label: string; wide?: boolean }[] = [
    { key: "code", label: "Project code" },
    { key: "title", label: "Project title", wide: true },
    { key: "client", label: "Client / asset owner" },
    { key: "consultant", label: "Consultant" },
    { key: "contractor", label: "Contractor" },
    { key: "authority", label: "Approving authority" },
    { key: "road", label: "Road / route" },
    { key: "chainage", label: "Chainage / limits" },
    { key: "workType", label: "Work type" },
    { key: "permit", label: "Permit / NOC number" },
    { key: "permitExpiry", label: "Permit expiry" },
    { key: "workingHours", label: "Working hours" },
    { key: "startDate", label: "Planned start" },
    { key: "endDate", label: "Planned finish" },
    { key: "drawing", label: "TDP/TMP drawing & revision" },
    { key: "drawingStatus", label: "Drawing status" },
    { key: "scope", label: "Need and scope statement", wide: true },
    { key: "constraints", label: "Constraints and interfaces", wide: true },
  ];
  const trafficFields: { key: keyof ProjectState["traffic"]; label: string }[] = [
    { key: "roadClass", label: "Road classification" },
    { key: "postedSpeed", label: "Posted / operating speed" },
    { key: "lanes", label: "Existing lanes" },
    { key: "laneWidth", label: "Lane / shoulder widths" },
    { key: "aadt", label: "AADT (Annual Average Daily Traffic)" },
    { key: "peakHour", label: "Peak-hour volume" },
    { key: "heavyVehicles", label: "Heavy vehicle percentage" },
    { key: "pedestrians", label: "Pedestrian / cyclist demand" },
    { key: "designVehicle", label: "Design vehicle" },
    { key: "emergencyRoute", label: "Emergency access requirement" },
  ];

  return (
    <div className="page-stack">
      <SectionHead
        code="01"
        title="Project Setup"
        description="Define the need, verify the site, and establish the traffic baseline before drawing a detour line. Unverified inputs become design risk."
      />

      <div className="method-ribbon">
        <span>INPUT</span><b>Need + scope</b><i>→</i><b>Field truth</b><i>→</i><b>Traffic demand</b><i>→</i><span>OUTPUT</span><b>Design brief</b>
      </div>

      <section className="panel form-panel">
        <div className="panel-heading">
          <div><span className="micro-label">S.1 — INPUTS & SCOPE</span><h3>Project identity and controls</h3></div>
          <span className="required-key">* verified values only</span>
        </div>
        <div className="form-grid">
          {projectFields.map((field) => (
            <label className={field.wide ? "field wide" : "field"} key={field.key}>
              <span>{field.label}</span>
              {field.wide ? (
                <textarea value={state.project[field.key]} onChange={(event) => updateProject(field.key, event.target.value)} rows={2} />
              ) : (
                <input value={state.project[field.key]} onChange={(event) => updateProject(field.key, event.target.value)} />
              )}
            </label>
          ))}
        </div>
      </section>

      <ChecklistBoard
        code="S.2 — SITE SURVEY"
        title="Site truth checklist"
        intro="Walk it, measure it, photograph it, and drive it by day and night. A desktop assumption is not field evidence."
        items={state.survey}
        onChange={(id, itemPatch) => updateChecklist("survey", id, itemPatch)}
      />

      <section className="panel form-panel">
        <div className="panel-heading">
          <div><span className="micro-label">S.3 — TRAFFIC DATA</span><h3>Operating baseline</h3></div>
          <span className="source-chip">RECORD SOURCE + DATE</span>
        </div>
        <div className="form-grid">
          {trafficFields.map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <input value={state.traffic[field.key]} onChange={(event) => updateTraffic(field.key, event.target.value)} />
            </label>
          ))}
        </div>
        <div className="engineering-note">
          <strong>Engineering decision, not data collection:</strong>
          <p>Use the baseline to test route capacity, queue storage, heavy-vehicle swept path, pedestrian demand, emergency access, and the safest work window.</p>
        </div>
      </section>
    </div>
  );
}

function DetourDesign({
  state,
  updateChecklist,
}: {
  state: ProjectState;
  updateChecklist: (group: CheckGroup, id: string, patch: Partial<ChecklistItem>) => void;
}) {
  return (
    <div className="page-stack">
      <SectionHead
        code="02"
        title="Detour Design"
        description="Compare feasible concepts before detailing the preferred route. The final TDP/TMP must control every road user, every work stage, and every interface."
        action={<span className="revision-chip">{state.project.drawing}</span>}
      />

      <section className="panel">
        <div className="panel-heading">
          <div><span className="micro-label">C.1 — OPTIONS</span><h3>Option comparison matrix</h3></div>
          <span className="source-chip">DECISION RECORD</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Option</th><th>Traffic arrangement</th><th>Safety</th><th>Capacity</th><th>Constructability</th><th>Primary risk</th><th>Decision</th></tr></thead>
            <tbody>
              {optionRows.map((row) => (
                <tr key={row.option} className={row.decision === "Preferred" ? "selected-row" : ""}>
                  <td><b className="option-letter">{row.option}</b></td><td>{row.route}</td><td>{row.safety}</td><td>{row.capacity}</td><td>{row.build}</td><td>{row.risk}</td><td><span className={`decision-pill ${row.decision.toLowerCase()}`}>{row.decision}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="design-canvas">
        <div className="canvas-head">
          <div><span className="micro-label">C.2 — DETAILED CONTROL</span><h3>Five-zone work-area logic</h3></div>
          <p>Direction of travel →</p>
        </div>
        <div className="road-diagram" aria-label="Temporary traffic control zones">
          <div className="zone advance"><span>01</span><strong>Advance warning</strong><small>Tell drivers what is ahead</small></div>
          <div className="zone transition"><span>02</span><strong>Transition</strong><small>Move traffic laterally</small></div>
          <div className="zone buffer"><span>03</span><strong>Buffer</strong><small>Recovery space — keep clear</small></div>
          <div className="zone work"><span>04</span><strong>Work space</strong><small>Workers, plant and excavation</small></div>
          <div className="zone termination"><span>05</span><strong>Termination</strong><small>Return traffic to normal</small></div>
        </div>
        <div className="diagram-legend">
          <span><i className="line solid" />positive protection where required</span>
          <span><i className="line dash" />channelizing device line</span>
          <span><i className="line clear" />keep buffer clear</span>
        </div>
      </section>

      <section className="control-grid">
        {[
          ["Geometry", "Lane widths · tapers · buffers · radii · sight distance · vertical clearance"],
          ["Road users", "Vehicles · heavy vehicles · pedestrians · cyclists · buses · people with disabilities"],
          ["Protection", "Barrier need · deflection · end treatment · excavation edge · crash exposure"],
          ["Operations", "Capacity · queue · access · emergency response · signals · flaggers · work hours"],
          ["Constructability", "Plant envelope · working room · material delivery · lifting · staging · egress"],
          ["Temporary devices", "Signs · markings · cones · barriers · lights · VMS · covers / steel plates"],
          ["Interfaces", "Utilities · drainage · lighting · adjacent projects · stakeholders · public information"],
          ["Quantities", "Device schedule · BOQ · spare stock · maintenance crew · inspection frequency"],
        ].map(([title, text], index) => (
          <article className="control-card" key={title}>
            <span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{text}</p>
          </article>
        ))}
      </section>

      <ChecklistBoard
        code="C.3 — DESIGN EVIDENCE"
        title="Release-to-assurance checklist"
        intro="Freeze the coordinated package only after option selection, traffic checks, constructability, and interdisciplinary evidence are recorded."
        items={state.design}
        onChange={(id, itemPatch) => updateChecklist("design", id, itemPatch)}
      />

      <section className="panel deliverable-panel">
        <div>
          <span className="micro-label">GATE 2 DELIVERABLE</span>
          <h3>Coordinated design package</h3>
          <p>TDP/TMP drawings + traffic analysis + staging + device schedule + method statement interfaces + risk controls + constructability record.</p>
        </div>
        <div className="hold-point"><span>HOLD POINT</span><strong>No issue for construction until interdisciplinary review is closed.</strong></div>
      </section>
    </div>
  );
}

function FieldAssurance({
  state,
  updateChecklist,
}: {
  state: ProjectState;
  updateChecklist: (
    group: "survey" | "readiness" | "opening" | "operation" | "closeout",
    id: string,
    patch: Partial<ChecklistItem>,
  ) => void;
}) {
  return (
    <div className="page-stack">
      <SectionHead
        code="03"
        title="Field Assurance"
        description="Use one traceable line from approved design to installed condition, opening acceptance, routine inspections, and safe reinstatement."
      />

      <div className="inspection-sequence">
        {[
          ["A", "Readiness", "Documents, permits, crew, materials"],
          ["B", "Install", "Safe sequence under controlled exposure"],
          ["C", "Inspect", "Day + night + drive-through + dimensions"],
          ["D", "Rectify", "Close defects with evidence"],
          ["E", "Accept", "Consultant / authority signature"],
          ["F", "Operate", "Routine + event-triggered inspection"],
        ].map(([key, title, detail]) => (
          <div key={key}><span>{key}</span><strong>{title}</strong><small>{detail}</small></div>
        ))}
      </div>

      <ChecklistBoard
        code="A.1 — PRE-INSTALLATION READINESS"
        title="Release-to-install checklist"
        intro="A failed mandatory line is a hold point. Record containment, assign an owner, and attach closure evidence."
        items={state.readiness}
        onChange={(id, itemPatch) => updateChecklist("readiness", id, itemPatch)}
      />
      <ChecklistBoard
        code="L.2 — PRE-OPENING ACCEPTANCE"
        title="Release-to-traffic checklist"
        intro="Inspect against the approved drawing, not memory. Complete the drive-through at the road-user eye level and verify at night."
        items={state.opening}
        onChange={(id, itemPatch) => updateChecklist("opening", id, itemPatch)}
      />
      <ChecklistBoard
        code="E.1 — ROUTINE OPERATION"
        title="Active detour inspection"
        intro="Use routine frequency plus event-triggered inspections after impact, weather, complaints, traffic changes, or stage switches."
        items={state.operation}
        onChange={(id, itemPatch) => updateChecklist("operation", id, itemPatch)}
      />
      <ChecklistBoard
        code="E.2 — REMOVAL & REINSTATEMENT"
        title="Return-to-normal checklist"
        intro="Remove the temporary arrangement safely, reinstate permanent assets, verify normal traffic, then archive the evidence and lessons learned."
        items={state.closeout}
        onChange={(id, itemPatch) => updateChecklist("closeout", id, itemPatch)}
      />
    </div>
  );
}

function ChecklistBoard({
  code,
  title,
  intro,
  items,
  onChange,
}: {
  code: string;
  title: string;
  intro: string;
  items: ChecklistItem[];
  onChange: (id: string, patch: Partial<ChecklistItem>) => void;
}) {
  const blockers = items.filter(isMandatoryGap).length;

  return (
    <section className="panel checklist-panel">
      <div className="panel-heading">
        <div><span className="micro-label">{code}</span><h3>{title}</h3><p>{intro}</p></div>
        <div className={blockers ? "gate-counter blocked" : "gate-counter ready"}>
          <strong>{blockers}</strong><span>{blockers ? "BLOCKERS" : "READY"}</span>
        </div>
      </div>
      <div className="checklist-head">
        <span>Control requirement</span><span>Owner</span><span>Status</span><span>Evidence / reference</span>
      </div>
      <div className="checklist-body">
        {items.map((item) => (
          <div className={`check-row ${item.status.toLowerCase().replace("/", "")}`} key={item.id}>
            <div className="check-label">
              <span className="check-indicator">{item.status === "Pass" ? "✓" : item.status === "Fail" ? "!" : item.status === "N/A" ? "—" : "○"}</span>
              <div><strong>{item.label}</strong><small>{item.required ? "MANDATORY" : "CONDITIONAL"}</small></div>
            </div>
            <input aria-label={`Owner for ${item.label}`} value={item.owner} onChange={(event) => onChange(item.id, { owner: event.target.value })} />
            <button
              className={`status-button ${item.status.toLowerCase().replace("/", "")}`}
              onClick={() => onChange(item.id, { status: statusOrder[(statusOrder.indexOf(item.status) + 1) % statusOrder.length] })}
              title="Click to cycle status"
            >
              {item.status}
            </button>
            <input
              className={(item.status === "Pass" || item.status === "N/A") && item.required && !item.evidence.trim() ? "evidence-input missing" : "evidence-input"}
              aria-label={`Evidence for ${item.label}`}
              aria-invalid={(item.status === "Pass" || item.status === "N/A") && item.required && !item.evidence.trim()}
              placeholder={item.status === "N/A" ? "Reason + approving reference required" : "Document, photo, record or signature"}
              value={item.evidence}
              onChange={(event) => onChange(item.id, { evidence: event.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="checklist-foot">
        <span>Open → Pass → Fail → N/A · Pass needs evidence; N/A needs a reason and approving reference.</span>
        <strong>{blockers ? "GATE HELD — close mandatory evidence gaps" : "GATE READY — obtain authorized signature"}</strong>
      </div>
    </section>
  );
}

function Records({
  state,
  setState,
}: {
  state: ProjectState;
  setState: React.Dispatch<React.SetStateAction<ProjectState>>;
}) {
  const [newIssue, setNewIssue] = useState("");
  const [newType, setNewType] = useState<IssueRecord["type"]>("Observation");

  function cycleDocument(id: string) {
    setState((current) => ({
      ...current,
      documents: current.documents.map((document) => {
        if (document.id !== id) return document;
        const next = documentStatusOrder[(documentStatusOrder.indexOf(document.status) + 1) % documentStatusOrder.length];
        return { ...document, status: next };
      }),
    }));
  }

  function addIssue() {
    const title = newIssue.trim();
    if (!title) return;
    setState((current) => ({
      ...current,
      issues: [
        ...current.issues,
        {
          id: `ISS-${String(current.issues.length + 7).padStart(3, "0")}`,
          type: newType,
          severity: "Medium",
          title,
          owner: "Unassigned",
          due: new Date().toISOString().slice(0, 10),
          status: newType === "Change" ? "Proposed" : "Open",
        },
      ],
    }));
    setNewIssue("");
  }

  function updateIssue(id: string, patch: Partial<IssueRecord>) {
    setState((current) => ({
      ...current,
      issues: current.issues.map((issue) => issue.id === id ? { ...issue, ...patch } : issue),
    }));
  }

  return (
    <div className="page-stack">
      <SectionHead
        code="04"
        title="Issues & Controlled Documents"
        description="Turn every question, defect, change, incident, and approval into an owned record with a due date and closure evidence."
      />

      <section className="panel">
        <div className="panel-heading">
          <div><span className="micro-label">DOCUMENT REGISTER</span><h3>Latest status and revision</h3></div>
          <span className="required-key">Click status to update</span>
        </div>
        <div className="table-wrap">
          <table className="record-table">
            <thead><tr><th>Type</th><th>Number</th><th>Rev.</th><th>Status</th><th>Owner</th><th>Due</th></tr></thead>
            <tbody>
              {state.documents.map((document) => (
                <tr key={document.id}>
                  <td><strong>{document.type}</strong></td><td className="mono">{document.number}</td><td>{document.revision}</td>
                  <td><button className={`record-status ${document.status.toLowerCase()}`} onClick={() => cycleDocument(document.id)}>{document.status}</button></td>
                  <td>{document.owner}</td><td>{document.due}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="document-rule">
          <strong>Release rule</strong>
          <span>Draft is not submitted. Submitted is not approved. Verify the latest revision and intended-use status before site release.</span>
        </div>
      </section>

      <section className="panel issue-panel">
        <div className="panel-heading">
          <div><span className="micro-label">UNIFIED ISSUE REGISTER</span><h3>From observation to verified closure</h3></div>
          <span className="source-chip">OWNER + DUE + EVIDENCE</span>
        </div>
        <div className="issue-composer">
          <select aria-label="Issue type" value={newType} onChange={(event) => setNewType(event.target.value as IssueRecord["type"])}>
            <option>Observation</option><option>NCR</option><option>RFI</option><option>Incident</option><option>Complaint</option><option>Change</option>
          </select>
          <input placeholder="Describe a field condition, question, defect, change or incident…" value={newIssue} onChange={(event) => setNewIssue(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addIssue()} />
          <button className="button primary" onClick={addIssue}>Add record</button>
        </div>
        <div className="issue-list">
          {state.issues.map((issue) => (
            <article className="issue-row" key={issue.id}>
              <div className="issue-id"><span>{issue.type}</span><strong>{issue.id}</strong></div>
              <div className="issue-title"><strong>{issue.title}</strong><small>{issueFlowLabels[issue.type]}</small></div>
              <select value={issue.severity} onChange={(event) => updateIssue(issue.id, { severity: event.target.value as IssueRecord["severity"] })} aria-label={`Severity for ${issue.id}`}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
              <input value={issue.owner} onChange={(event) => updateIssue(issue.id, { owner: event.target.value })} aria-label={`Owner for ${issue.id}`} />
              <input type="date" value={issue.due} onChange={(event) => updateIssue(issue.id, { due: event.target.value })} aria-label={`Due date for ${issue.id}`} />
              <select value={issue.status} onChange={(event) => updateIssue(issue.id, { status: event.target.value as IssueRecord["status"] })} aria-label={`Status for ${issue.id}`}>
                {issueStatusOptions[issue.type].map((status) => <option key={status}>{status}</option>)}
              </select>
            </article>
          ))}
        </div>
      </section>

      <section className="record-logic">
        <div><span>01</span><strong>Observe</strong><small>Record fact, location, time and evidence</small></div>
        <div><span>02</span><strong>Contain</strong><small>Protect road users immediately</small></div>
        <div><span>03</span><strong>Assign</strong><small>Owner, due date and priority</small></div>
        <div><span>04</span><strong>Resolve</strong><small>Root cause and corrective action</small></div>
        <div><span>05</span><strong>Verify</strong><small>Independent closure evidence</small></div>
      </section>
    </div>
  );
}

function Reports({
  state,
  setState,
}: {
  state: ProjectState;
  setState: React.Dispatch<React.SetStateAction<ProjectState>>;
}) {
  const [reportType, setReportType] = useState(reportTypes[0]);
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
        <div><span>PROJECT</span><strong>{state.project.code} · {state.project.title}</strong></div>
        <div><span>CONTROLLED DRAWING</span><strong>{state.project.drawing}</strong></div>
      </section>

      <section className="report-sheet">
        <header>
          <div><span className="report-logo">DO</span><div><small>DETOUR OPERATIONS RECORD</small><h3>{reportType}</h3></div></div>
          <div><small>REPORT STATUS</small><strong>DRAFT</strong></div>
        </header>
        <div className="report-meta">
          <div><span>Project</span><b>{state.project.code}</b></div>
          <div><span>Road / location</span><b>{state.project.road} · {state.project.chainage}</b></div>
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

function CodeAssistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [uploadState, setUploadState] = useState("No indexed sources");

  async function uploadSource(file?: File) {
    if (!file) return;
    setUploadState("Storing source…");
    const body = new FormData();
    body.append("file", file);
    body.append("category", "code-source");
    try {
      const response = await fetch("/api/files", { method: "POST", body });
      if (response.status === 401) {
        setUploadState("Sign in on the private site to store sources");
        return;
      }
      if (!response.ok) throw new Error("Upload failed");
      setUploadState("Stored privately · indexing connector pending");
    } catch {
      setUploadState("Source storage unavailable in local demo");
    }
  }

  function askSourceOnly(event: React.FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setAnswer(
      "Answer withheld: no approved source has been indexed. DetourOps will not answer from general model knowledge. Connect the approved corpus and retrieval service first.",
    );
  }

  return (
    <div className="page-stack assistant-page">
      <SectionHead
        code="AI"
        title="Source-Controlled Code Assistant"
        description="A RAG-ready workspace for asking the Saudi Highway Code and approved project documents—designed to answer only from indexed sources and show the exact citation."
        action={<span className="offline-chip">INDEXING NOT CONNECTED</span>}
      />

      <section className="assistant-grid">
        <article className="source-vault">
          <div className="vault-head"><div><span className="micro-label">APPROVED CORPUS</span><h3>Source vault</h3></div><span>0 INDEXED</span></div>
          <div className="source-row pending">
            <div className="file-mark">PDF</div><div><strong>Saudi Highway Code 305</strong><small>Candidate source · verify edition and authority</small></div><span>PENDING</span>
          </div>
          <div className="source-row empty">
            <div className="file-mark">TDP</div><div><strong>Approved project TDP/TMP</strong><small>Not uploaded</small></div><span>EMPTY</span>
          </div>
          <label className="upload-source">
            <span>+ Add approved PDF or XLSX source</span>
            <input type="file" accept=".pdf,.xlsx,image/png,image/jpeg" onChange={(event) => void uploadSource(event.target.files?.[0])} />
          </label>
          <p className="upload-state">{uploadState}</p>
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
            <div><span className="ai-signal">AI</span><div><strong>Code Query</strong><small>Source-only policy · citations required</small></div></div>
            <span className="locked-status">LOCKED</span>
          </header>
          <div className="chat-body">
            <div className="system-message">
              <span>ANSWER POLICY</span>
              <p>Use only retrieved passages from approved sources. Cite source, edition, section and page. If evidence is absent or conflicting, abstain and escalate.</p>
            </div>
            <div className="suggested-questions">
              <span>AFTER INDEXING, ASK:</span>
              {["What controls apply to a lane closure at this speed?", "Where does the code define taper length?", "What must be checked before opening the detour?"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}
            </div>
            {answer && <div className="assistant-answer"><span>DETOUROPS</span><p>{answer}</p><small>No citation · no answer</small></div>}
          </div>
          <form className="chat-input" onSubmit={askSourceOnly}>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask an approved-source question…" />
            <button type="submit">Ask</button>
          </form>
        </article>
      </section>

      <section className="rag-contract">
        <div className="contract-head"><span className="micro-label">IMPLEMENTATION CONTRACT</span><h3>How a trustworthy answer is produced</h3></div>
        <div className="rag-flow">
          <div><span>01</span><strong>Ingest</strong><small>Approved files + metadata</small></div><i>→</i>
          <div><span>02</span><strong>Retrieve</strong><small>Relevant source passages</small></div><i>→</i>
          <div><span>03</span><strong>Answer</strong><small>Only from retrieved context</small></div><i>→</i>
          <div><span>04</span><strong>Cite</strong><small>Source + section + page</small></div><i>→</i>
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
