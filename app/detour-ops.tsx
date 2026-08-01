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
            ? phaseBlockers > 0 ? `${p…17858 tokens truncated…isplay: grid; gap: 5px; padding: 13px; border-right: 1px solid var(--line); }.report-meta span { color: var(--muted); font-size: 9px; text-transform: uppercase; }.report-meta b { font-size: 11px; }
.report-form { display: grid; grid-template-columns: repeat(3, 1fr); }.report-field { grid-column: 1 / -1; display: grid; gap: 7px; padding: 14px 18px; border-bottom: 1px solid var(--line); }.report-field.short { grid-column: span 1; }.report-field textarea { resize: vertical; line-height: 1.5; }.report-signatures { display: grid; grid-template-columns: repeat(3, 1fr); }.report-signatures > div { min-height: 125px; display: grid; align-content: start; gap: 8px; padding: 18px; border-right: 1px solid var(--line); }.report-signatures span { color: var(--muted); font-size: 9px; text-transform: uppercase; }.report-signatures i { margin-top: 32px; padding-top: 6px; color: var(--muted); border-top: 1px solid var(--line); font-size: 9px; }

.assistant-grid { display: grid; grid-template-columns: .8fr 1.3fr; gap: 18px; }.source-vault, .chat-console, .rag-contract { background: var(--white); border: 1px solid var(--line); box-shadow: var(--shadow); }.vault-head, .chat-console > header { min-height: 72px; display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid var(--line); }.vault-head h3 { margin: 3px 0 0; font: 800 20px "Bahnschrift", "Arial Narrow", sans-serif; }.vault-head > span { color: var(--red); font: 800 9px Consolas, monospace; }
.source-row { display: grid; grid-template-columns: 42px 1fr auto; align-items: center; gap: 11px; padding: 14px 17px; border-bottom: 1px solid var(--paper-2); }.file-mark { display: grid; place-items: center; height: 38px; color: var(--white); background: var(--ink); font: 800 9px Consolas, monospace; }.source-row > div:nth-child(2) { display: grid; gap: 3px; }.source-row small { color: var(--muted); }.source-row > span { padding: 5px; background: var(--paper-2); color: var(--muted); font: 800 8px Consolas, monospace; }.source-row.pending > span { color: #805e00; background: #fff2bd; }
.upload-source { display: grid; place-items: center; min-height: 55px; margin: 14px; border: 1px dashed var(--teal); color: var(--teal); background: #eff9f8; font-weight: 800; cursor: pointer; }.upload-source input { position: absolute; opacity: 0; pointer-events: none; }.upload-state { margin: -5px 16px 14px; color: var(--muted); font-size: 10px; text-align: center; }.corpus-rules { margin: 15px; padding: 15px; background: var(--paper-2); }.corpus-rules h4 { margin: 0 0 9px; }.corpus-rules ul { margin: 0; padding-left: 17px; color: var(--muted); line-height: 1.7; font-size: 11px; }
.chat-console { display: grid; grid-template-rows: auto minmax(360px, 1fr) auto; background: #f8f7f2; }.chat-console > header > div { display: flex; align-items: center; gap: 10px; }.chat-console header div div { display: grid; gap: 3px; }.chat-console header small { color: var(--muted); }.ai-signal { width: 38px; height: 38px; display: grid; place-items: center; background: var(--teal); color: white; font: 800 12px Consolas, monospace; }.locked-status { padding: 6px 8px; color: var(--red); border: 1px solid var(--red); font: 800 9px Consolas, monospace; }.chat-body { display: grid; align-content: start; gap: 17px; padding: 22px; }.system-message { padding: 14px; border-left: 5px solid var(--amber); background: #fff5d5; }.system-message span, .suggested-questions > span, .assistant-answer > span { font: 800 8px Consolas, monospace; letter-spacing: .1em; }.system-message p { margin: 7px 0 0; color: #5b573f; line-height: 1.5; }.suggested-questions { display: grid; gap: 7px; }.suggested-questions button { padding: 9px 11px; text-align: left; color: var(--ink); background: white; border: 1px solid var(--line); }.assistant-answer { max-width: 80%; padding: 15px; background: var(--ink); color: var(--white); }.assistant-answer > span { color: var(--amber); }.assistant-answer p { margin: 8px 0; line-height: 1.55; }.assistant-answer small { color: #9fb0b7; }.chat-input { display: grid; grid-template-columns: 1fr auto; gap: 8px; padding: 13px; border-top: 1px solid var(--line); background: white; }.chat-input button { border: 0; background: var(--teal); color: white; padding: 0 20px; font-weight: 800; }
.rag-contract { padding: 20px; }.contract-head h3 { margin: 3px 0 0; font: 800 22px "Bahnschrift", "Arial Narrow", sans-serif; }.rag-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr auto 1fr; gap: 8px; align-items: center; margin-top: 20px; }.rag-flow > div { min-height: 105px; display: grid; align-content: center; padding: 13px; background: var(--paper-2); border-top: 4px solid var(--teal); }.rag-flow span { color: var(--teal); font: 800 10px Consolas, monospace; }.rag-flow strong { margin: 7px 0 3px; }.rag-flow small { color: var(--muted); }.rag-flow > i { color: var(--muted); }.contract-warning { display: flex; gap: 20px; align-items: baseline; margin-top: 16px; padding: 14px; background: #fff0ee; border-left: 5px solid var(--red); }.contract-warning p { margin: 0; color: #6f504d; line-height: 1.45; }

@media (max-width: 1150px) {
  .topbar { grid-template-columns: 250px 1fr auto; }.topbar-project > span:last-child, .save-readout { display: none; }
  .workspace { grid-template-columns: 205px minmax(0, 1fr); }.side-rail { padding-inline: 8px; }
  .metric-grid, .metric-grid.five, .control-grid { grid-template-columns: repeat(2, 1fr); }.form-grid { grid-template-columns: repeat(2, 1fr); }
  .split-grid, .assistant-grid { grid-template-columns: 1fr; }
  .issue-row { grid-template-columns: 76px 1fr 90px; }.issue-row > *:nth-child(n+4) { grid-column: span 1; }
}

@media (max-width: 760px) {
  .topbar { height: 68px; grid-template-columns: auto 1fr auto; }.brand-lockup { border: 0; padding: 0 10px; }.brand-lockup .eyebrow, .brand-mark, .topbar-project, .topbar-actions .ghost { display: none; }.brand-lockup h1 { font-size: 20px; }.topbar-actions { padding: 0 8px; }.topbar-actions .button { padding: 8px; font-size: 9px; }
  .mobile-rail-toggle { display: block; height: 100%; padding: 0 12px; color: var(--amber); background: transparent; border: 0; font: 800 10px Consolas, monospace; }
  .workspace { display: block; min-height: calc(100vh - 68px); }.side-rail { display: none; position: fixed; z-index: 40; top: 68px; left: 0; width: 260px; height: calc(100vh - 68px); }.side-rail.open { display: block; }
  .status-strip { padding: 9px 14px; }.strip-metrics { display: none !important; }.page-stack { padding: 17px 13px; gap: 16px; }
  .section-head { grid-template-columns: 46px 1fr; }.section-code { width: 46px; height: 46px; box-shadow: 4px 4px 0 var(--ink); font-size: 16px; }.section-head h2 { font-size: 25px; }.section-action { grid-column: 1 / -1; justify-self: stretch; }.section-action > * { width: 100%; text-align: center; }
  .control-head-actions { display: grid; grid-template-columns: 1fr auto; }.gate-selector { min-width: 0; text-align: left; }
  .hero-board { grid-template-columns: 1fr; }.hero-copy { padding: 30px 23px; }.hero-copy h3 { font-size: 37px; }.hero-signal { border-left: 0; border-top: 1px solid #39515c; }.phase-road { grid-template-columns: repeat(5, 230px); }
  .metric-grid, .metric-grid.five, .control-grid, .form-grid { grid-template-columns: 1fr; }.field.wide { grid-column: auto; }.split-grid { grid-template-columns: 1fr; }.engineering-note, .contract-warning, .document-rule { display: grid; }
  .signal-cluster { grid-template-columns: 140px 1fr; }.signal-ring { width: 140px; height: 140px; }
  .checklist-panel { overflow-x: auto; }.checklist-panel .panel-heading, .checklist-foot { min-width: 820px; }.checklist-head { min-width: 820px; }
  .inspection-sequence { grid-template-columns: repeat(6, 180px); overflow-x: auto; }.record-logic { grid-template-columns: repeat(5, 180px); overflow-x: auto; }
  .deliverable-panel { grid-template-columns: 1fr; }.report-picker { grid-template-columns: 1fr; }.report-meta { grid-template-columns: repeat(2, 1fr); }.report-form { grid-template-columns: 1fr; }.report-field.short { grid-column: 1; }.report-signatures { grid-template-columns: 1fr; }
  .issue-composer { grid-template-columns: 1fr; }.issue-row { grid-template-columns: 1fr 1fr; }.issue-title { grid-column: 1 / -1; }
  .rag-flow { grid-template-columns: 1fr; }.rag-flow > i { transform: rotate(90deg); text-align: center; }
}

@media print {
  body { background: white; font-size: 10px; }
  .topbar, .side-rail, .status-strip, .section-head .button, .button, .issue-composer, .chat-input { display: none !important; }
  .workspace { display: block; }.page-stack { padding: 0; }.panel, .report-sheet { box-shadow: none; break-inside: avoid; }.main-stage { width: 100%; }
  .report-sheet { border: 0; }.report-sheet input, .report-sheet textarea { border: 0; padding: 0; background: transparent; }
}

@media (prefers-reduced-motion: reduce) {
  * { scroll-behavior: auto !important; transition: none !important; }
}
