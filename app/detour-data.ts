export type CheckStatus = "Open" | "Pass" | "Fail" | "N/A";
export type RecordStatus = "Draft" | "Submitted" | "Approved" | "Rejected";
export type IssueType = "Observation" | "NCR" | "RFI" | "Incident" | "Complaint" | "Change";
export type IssueStatus =
  | "Open"
  | "Contained"
  | "Corrective Action"
  | "Verification"
  | "Submitted"
  | "Answered"
  | "Proposed"
  | "Under Review"
  | "Approved"
  | "Implemented"
  | "Closed";

export type ChecklistItem = {
  id: string;
  label: string;
  owner: string;
  required: boolean;
  status: CheckStatus;
  evidence: string;
};

export type DocumentRecord = {
  id: string;
  type: string;
  number: string;
  revision: string;
  status: RecordStatus;
  owner: string;
  due: string;
};

export type IssueRecord = {
  id: string;
  type: IssueType;
  severity: "Low" | "Medium" | "High" | "Critical";
  title: string;
  owner: string;
  due: string;
  status: IssueStatus;
};

export type ProjectState = {
  schemaVersion: 2;
  workflow: {
    currentPhase: number;
  };
  project: {
    code: string;
    title: string;
    client: string;
    consultant: string;
    contractor: string;
    authority: string;
    road: string;
    chainage: string;
    workType: string;
    permit: string;
    permitExpiry: string;
    startDate: string;
    endDate: string;
    workingHours: string;
    drawing: string;
    drawingStatus: string;
    scope: string;
    constraints: string;
  };
  traffic: {
    roadClass: string;
    postedSpeed: string;
    lanes: string;
    laneWidth: string;
    aadt: string;
    peakHour: string;
    heavyVehicles: string;
    pedestrians: string;
    designVehicle: string;
    emergencyRoute: string;
  };
  survey: ChecklistItem[];
  design: ChecklistItem[];
  readiness: ChecklistItem[];
  opening: ChecklistItem[];
  operation: ChecklistItem[];
  closeout: ChecklistItem[];
  documents: DocumentRecord[];
  issues: IssueRecord[];
  report: {
    date: string;
    shift: string;
    weather: string;
    trafficCondition: string;
    worksCompleted: string;
    inspections: string;
    incidents: string;
    nextShift: string;
  };
};

export const phases = [
  {
    key: "S",
    name: "Project Setup",
    short: "Need · scope · survey · traffic",
    gate: "Design brief issued",
    holdLine: "Do not issue the design brief.",
    readyLine: "The design brief is ready for authorized issue.",
    steps: ["Inputs & Scope", "Site Survey", "Traffic Data"],
  },
  {
    key: "C",
    name: "Detour Design",
    short: "Options · geometry · TTM · staging",
    gate: "Coordinated design frozen",
    holdLine: "Do not freeze the coordinated design.",
    readyLine: "The coordinated design is ready for formal review.",
    steps: ["Options & Controls", "Detailed TDP/TMP"],
  },
  {
    key: "A",
    name: "Assurance & Authorization",
    short: "Risk · constructability · approvals",
    gate: "Approved for installation",
    holdLine: "Do not release installation.",
    readyLine: "Installation evidence is ready for authorized release.",
    steps: ["QA/HSE Review", "Consultant & Authority Approval"],
  },
  {
    key: "L",
    name: "Field Deployment & Acceptance",
    short: "Install · inspect · rectify · open",
    gate: "Signed opening acceptance",
    holdLine: "Do not open the detour to traffic.",
    readyLine: "The detour is ready for authorized opening acceptance.",
    steps: ["Installation", "Pre-opening Inspection"],
  },
  {
    key: "E",
    name: "Operation & Closeout",
    short: "Monitor · change · remove · restore",
    gate: "Normal traffic restored",
    holdLine: "Do not close out the diversion.",
    readyLine: "Closeout evidence is ready for final acceptance.",
    steps: ["Operate & Maintain", "Removal & Reinstatement"],
  },
] as const;

const check = (
  id: string,
  label: string,
  owner: string,
  required = true,
  status: CheckStatus = "Open",
  evidence = "",
): ChecklistItem => ({ id, label, owner, required, status, evidence });

export const initialState: ProjectState = {
  schemaVersion: 2,
  workflow: {
    currentPhase: 2,
  },
  project: {
    code: "DT-024",
    title: "Utility Crossing — Temporary Traffic Diversion",
    client: "Royal Commission (demo)",
    consultant: "Supervision Consultant",
    contractor: "Main Contractor",
    authority: "Road / Traffic Authority",
    road: "Industrial Access Road 04",
    chainage: "CH 1+240 to CH 1+510",
    workType: "Utility excavation and crossing",
    permit: "ROW-PENDING",
    permitExpiry: "2026-08-30",
    startDate: "2026-08-05",
    endDate: "2026-08-18",
    workingHours: "22:00–05:00",
    drawing: "TDP-DT024-001 Rev.01",
    drawingStatus: "Submitted for approval",
    scope:
      "Maintain safe access while excavating the existing carriageway in two controlled stages.",
    constraints:
      "Heavy vehicles, two industrial accesses, night work, pedestrian desire line, limited shoulder.",
  },
  traffic: {
    roadClass: "Industrial arterial",
    postedSpeed: "80 km/h",
    lanes: "2 lanes / direction",
    laneWidth: "3.65 m",
    aadt: "18,400 veh/day (demo)",
    peakHour: "1,480 veh/h (demo)",
    heavyVehicles: "24% (demo)",
    pedestrians: "Moderate — shift change peak",
    designVehicle: "WB-20 / articulated truck",
    emergencyRoute: "Maintain one 3.65 m clear lane at all times",
  },
  survey: [
    check("sv-1", "Confirm road geometry, lane and shoulder widths", "Traffic Engineer", true, "Pass", "Survey sheet S-01"),
    check("sv-2", "Map junctions, accesses, bus stops and pedestrian desire lines", "Traffic Engineer", true, "Pass", "Marked-up plan"),
    check("sv-3", "Record existing signs, markings, lighting and drainage", "Site Engineer", true, "Pass", "Photo log 01–28"),
    check("sv-4", "Verify utilities and excavation limits with responsible discipline", "Utility Engineer", true, "Pass", "Utility clearance UC-024"),
    check("sv-5", "Complete day and night drive-through", "Traffic Engineer", true, "Pass", "Survey record SR-024"),
  ],
  design: [
    check("ds-1", "Preferred detour option selected with a recorded decision", "Traffic Engineer", true, "Pass", "Option assessment DCR-024"),
    check("ds-2", "Traffic capacity, queues and heavy-vehicle movements checked", "Traffic Engineer", true, "Pass", "Traffic note TN-024"),
    check("ds-3", "Geometry, devices, protection and pedestrian controls coordinated", "Design Manager", true, "Pass", "Coordination review CR-024"),
    check("ds-4", "Constructability and plant working envelope verified", "Construction Manager", true, "Pass", "Constructability workshop CW-024"),
    check("ds-5", "Coordinated TDP/TMP package issued for approval", "Document Controller", true, "Pass", "TDP-DT024-001 Rev.01"),
  ],
  readiness: [
    check("rd-1", "Latest approved TDP/TMP available at site", "Document Controller", true, "Fail"),
    check("rd-2", "Permit / NOC valid for location, dates and work stage", "Construction Manager", true, "Open"),
    check("rd-3", "Method statement and RA/JSA briefed to the crew", "HSE Engineer", true, "Pass", "TBT-024"),
    check("rd-4", "Signs, barriers, lights and channelizing devices inspected", "Traffic Supervisor", true, "Pass", "MIR-116"),
    check("rd-5", "Emergency, stakeholder and public notification plan confirmed", "Project Manager", true, "Open"),
    check("rd-6", "Weather, event and conflicting-work window checked", "Planner", false, "Pass", "2-week lookahead"),
  ],
  opening: [
    check("op-1", "Advance warning signs installed in correct order and orientation", "Traffic Engineer", true, "Open"),
    check("op-2", "Tapers, transitions, buffers and work space match approved drawing", "Traffic Engineer", true, "Open"),
    check("op-3", "Positive protection and end treatments are complete", "HSE Engineer", true, "Open"),
    check("op-4", "Lane width, swept path, access and sight distance verified", "Traffic Engineer", true, "Open"),
    check("op-5", "Pedestrian route is continuous, accessible, lit and protected", "HSE Engineer", true, "Open"),
    check("op-6", "Night visibility and drive-through completed in both directions", "Consultant", true, "Open"),
    check("op-7", "Defects closed and opening checklist signed", "Consultant", true, "Open"),
  ],
  operation: [
    check("mt-1", "Signs remain upright, visible, clean and relevant", "Traffic Supervisor", true, "Pass", "06:00 inspection"),
    check("mt-2", "Cones, barriers and lights remain aligned and serviceable", "Traffic Supervisor", true, "Pass", "06:00 inspection"),
    check("mt-3", "Queue, delay, wrong-way movement and near misses monitored", "Traffic Engineer", true, "Open"),
    check("mt-4", "Mud, debris, ponding and pavement defects controlled", "Site Engineer", true, "Pass", "Housekeeping log"),
    check("mt-5", "Reinspect after impact, weather, complaint or stage change", "Traffic Engineer", true, "N/A", "No trigger event at current review"),
  ],
  closeout: [
    check("cl-1", "Authority approves removal / switch-back window", "Project Manager"),
    check("cl-2", "Temporary devices removed in safe reverse sequence", "Traffic Supervisor"),
    check("cl-3", "Permanent pavement, markings, signs and assets reinstated", "Site Engineer"),
    check("cl-4", "Normal traffic drive-through and final inspection passed", "Consultant"),
    check("cl-5", "As-built, photos, permits, NCRs and lessons learned archived", "Document Controller"),
  ],
  documents: [
    { id: "doc-1", type: "TDP / TMP", number: "TDP-DT024-001", revision: "01", status: "Submitted", owner: "Traffic Engineer", due: "2026-08-02" },
    { id: "doc-2", type: "Method Statement", number: "MS-CIV-144", revision: "02", status: "Approved", owner: "Construction", due: "2026-08-01" },
    { id: "doc-3", type: "RA / JSA", number: "RA-TTM-024", revision: "01", status: "Approved", owner: "HSE", due: "2026-08-01" },
    { id: "doc-4", type: "Road Opening Permit", number: "ROW-PENDING", revision: "—", status: "Draft", owner: "Permits", due: "2026-08-03" },
    { id: "doc-5", type: "Material Inspection Request (MIR)", number: "MIR-116", revision: "00", status: "Approved", owner: "QA/QC", due: "2026-07-31" },
    { id: "doc-6", type: "Pre-opening Checklist", number: "CHK-DT024", revision: "00", status: "Draft", owner: "Traffic Engineer", due: "2026-08-04" },
  ],
  issues: [
    { id: "ISS-007", type: "RFI", severity: "Medium", title: "Confirm utility conflict at CH 1+385", owner: "Design Manager", due: "2026-08-02", status: "Submitted" },
    { id: "ISS-008", type: "Observation", severity: "High", title: "Approved TDP not available at site", owner: "Document Controller", due: "2026-08-01", status: "Contained" },
  ],
  report: {
    date: "2026-08-01",
    shift: "Day shift",
    weather: "Clear / dry",
    trafficCondition: "Normal flow; no abnormal queue observed",
    worksCompleted: "Site verification, photo log, device material inspection.",
    inspections: "Day survey completed. Night drive-through pending.",
    incidents: "None. One design RFI remains open.",
    nextShift: "Close utility RFI, confirm permit, complete night drive-through.",
  },
};

export const optionRows = [
  { option: "A", route: "Shift within carriageway", safety: "High", capacity: "High", build: "Medium", risk: "Utility conflict", decision: "Preferred" },
  { option: "B", route: "Use existing shoulder", safety: "Medium", capacity: "High", build: "Low", risk: "Insufficient shoulder width", decision: "Hold" },
  { option: "C", route: "External local-road detour", safety: "Medium", capacity: "Low", build: "High", risk: "Residential impact", decision: "Rejected" },
];

export const reportTypes = [
  "Daily TTM Report",
  "Pre-opening Inspection",
  "Night Inspection",
  "Weekly Performance Summary",
  "Incident / Near Miss Report",
  "NCR Response & Closure",
  "RFI / Technical Query",
  "Stage Switch Record",
  "Opening Acceptance Certificate",
  "Removal & Reinstatement Record",
];
