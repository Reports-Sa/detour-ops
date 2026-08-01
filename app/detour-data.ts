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
    { id: "doc-6", type: "Pre-opening Checklist", number: "CHK-DT024", revision: "00", status: "Draft", owner: "Traffic Engine…136792 tokens truncated…openharmony-arm64-0.27.3.tgz",
      "integrity": "sha512-NinAEgr/etERPTsZJ7aEZQvvg/A6IsZG/LgZy+81wON2huV7SrK3e63dU0XhyZP4RKGyTm7aOgmQk0bGp0fy2g==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "openharmony"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrangler/node_modules/@esbuild/sunos-x64": {
      "version": "0.27.3",
      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.27.3.tgz",
      "integrity": "sha512-PanZ+nEz+eWoBJ8/f8HKxTTD172SKwdXebZ0ndd953gt1HRBbhMsaNqjTyYLGLPdoWHy4zLU7bDVJztF5f3BHA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "sunos"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrangler/node_modules/@esbuild/win32-arm64": {
      "version": "0.27.3",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.27.3.tgz",
      "integrity": "sha512-B2t59lWWYrbRDw/tjiWOuzSsFh1Y/E95ofKz7rIVYSQkUYBjfSgf6oeYPNWHToFRr2zx52JKApIcAS/D5TUBnA==",
      "cpu": [
        "arm64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrangler/node_modules/@esbuild/win32-ia32": {
      "version": "0.27.3",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.27.3.tgz",
      "integrity": "sha512-QLKSFeXNS8+tHW7tZpMtjlNb7HKau0QDpwm49u0vUp9y1WOF+PEzkU84y9GqYaAVW8aH8f3GcBck26jh54cX4Q==",
      "cpu": [
        "ia32"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrangler/node_modules/@esbuild/win32-x64": {
      "version": "0.27.3",
      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.27.3.tgz",
      "integrity": "sha512-4uJGhsxuptu3OcpVAzli+/gWusVGwZZHTlS63hh++ehExkVT8SgiEf7/uC/PclrPPkLhZqGgCTjd0VWLo6xMqA==",
      "cpu": [
        "x64"
      ],
      "dev": true,
      "license": "MIT",
      "optional": true,
      "os": [
        "win32"
      ],
      "engines": {
        "node": ">=18"
      }
    },
    "node_modules/wrangler/node_modules/esbuild": {
      "version": "0.27.3",
      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.27.3.tgz",
      "integrity": "sha512-8VwMnyGCONIs6cWue2IdpHxHnAjzxnw2Zr7MkVxB2vjmQ2ivqGFb4LEG3SMnv0Gb2F/G/2yA8zUaiL1gywDCCg==",
      "dev": true,
      "hasInstallScript": true,
      "license": "MIT",
      "bin": {
        "esbuild": "bin/esbuild"
      },
      "engines": {
        "node": ">=18"
      },
      "optionalDependencies": {
        "@esbuild/aix-ppc64": "0.27.3",
        "@esbuild/android-arm": "0.27.3",
        "@esbuild/android-arm64": "0.27.3",
        "@esbuild/android-x64": "0.27.3",
        "@esbuild/darwin-arm64": "0.27.3",
        "@esbuild/darwin-x64": "0.27.3",
        "@esbuild/freebsd-arm64": "0.27.3",
        "@esbuild/freebsd-x64": "0.27.3",
        "@esbuild/linux-arm": "0.27.3",
        "@esbuild/linux-arm64": "0.27.3",
        "@esbuild/linux-ia32": "0.27.3",
        "@esbuild/linux-loong64": "0.27.3",
        "@esbuild/linux-mips64el": "0.27.3",
        "@esbuild/linux-ppc64": "0.27.3",
        "@esbuild/linux-riscv64": "0.27.3",
        "@esbuild/linux-s390x": "0.27.3",
        "@esbuild/linux-x64": "0.27.3",
        "@esbuild/netbsd-arm64": "0.27.3",
        "@esbuild/netbsd-x64": "0.27.3",
        "@esbuild/openbsd-arm64": "0.27.3",
        "@esbuild/openbsd-x64": "0.27.3",
        "@esbuild/openharmony-arm64": "0.27.3",
        "@esbuild/sunos-x64": "0.27.3",
        "@esbuild/win32-arm64": "0.27.3",
        "@esbuild/win32-ia32": "0.27.3",
        "@esbuild/win32-x64": "0.27.3"
      }
    },
    "node_modules/ws": {
      "version": "8.18.0",
      "resolved": "https://registry.npmjs.org/ws/-/ws-8.18.0.tgz",
      "integrity": "sha512-8VbfWfHLbbwu3+N6OKsOMpBdT4kXPDDB9cJk2bJ6mh9ucxdlnNvH1e+roYkKmN9Nxw2yjz7VzeO9oOz2zJ04Pw==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10.0.0"
      },
      "peerDependencies": {
        "bufferutil": "^4.0.1",
        "utf-8-validate": ">=5.0.2"
      },
      "peerDependenciesMeta": {
        "bufferutil": {
          "optional": true
        },
        "utf-8-validate": {
          "optional": true
        }
      }
    },
    "node_modules/yallist": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/yallist/-/yallist-3.1.1.tgz",
      "integrity": "sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/yoga-layout": {
      "version": "3.2.1",
      "resolved": "https://registry.npmjs.org/yoga-layout/-/yoga-layout-3.2.1.tgz",
      "integrity": "sha512-0LPOt3AxKqMdFBZA3HBAt/t/8vIKq7VaQYbuA8WxCgung+p9TVyKRYdpvCb80HcdTN2NkbIKbhNwKUfm3tQywQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/youch": {
      "version": "4.1.0-beta.10",
      "resolved": "https://registry.npmjs.org/youch/-/youch-4.1.0-beta.10.tgz",
      "integrity": "sha512-rLfVLB4FgQneDr0dv1oddCVZmKjcJ6yX6mS4pU82Mq/Dt9a3cLZQ62pDBL4AUO+uVrCvtWz3ZFUL2HFAFJ/BXQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@poppinss/colors": "^4.1.5",
        "@poppinss/dumper": "^0.6.4",
        "@speed-highlight/core": "^1.2.7",
        "cookie": "^1.0.2",
        "youch-core": "^0.3.3"
      }
    },
    "node_modules/youch-core": {
      "version": "0.3.3",
      "resolved": "https://registry.npmjs.org/youch-core/-/youch-core-0.3.3.tgz",
      "integrity": "sha512-ho7XuGjLaJ2hWHoK8yFnsUGy2Y5uDpqSTq1FkHLK4/oqKtyUU1AFbOOxY4IpC9f0fTLjwYbslUz0Po5BpD1wrA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@poppinss/exception": "^1.2.2",
        "error-stack-parser-es": "^1.0.5"
      }
    },
    "node_modules/zod": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/zod/-/zod-4.4.3.tgz",
      "integrity": "sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/colinhacks"
      }
    },
    "node_modules/zod-validation-error": {
      "version": "4.0.2",
      "resolved": "https://registry.npmjs.org/zod-validation-error/-/zod-validation-error-4.0.2.tgz",
      "integrity": "sha512-Q6/nZLe6jxuU80qb/4uJ4t5v2VEZ44lzQjPDhYJNztRQ4wyWc6VF3D3Kb/fAuPetZQnhS3hnajCf9CsWesghLQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18.0.0"
      },
      "peerDependencies": {
        "zod": "^3.25.0 || ^4.0.0"
      }
    }
  }
}
