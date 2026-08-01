# DetourOps

**From Project Need to Normal Traffic**

[Open the live DetourOps application](https://detour-ops-ghazi.ghazi.chatgpt.site)

DetourOps is a practical planning and control companion for traffic diversion
work. It is designed to help a traffic engineer structure decisions, track
evidence, and move safely from the initial project need through restoration of
normal traffic.

The workflow organizes the full lifecycle into five gated phases:

1. Project Setup
2. Detour Design
3. Assurance & Authorization
4. Field Deployment & Acceptance
5. Operation & Closeout

The interface includes a control board, editable project and traffic records,
site-survey and field checklists, an option matrix, a controlled-document
register, a unified issue register, printable operational reports, and a
source-controlled Code Assistant integration contract.

Release decisions distinguish **current-gate blockers** (including unresolved
carry-over controls) from **future mandatory controls** that are tracked but
not yet due. Mandatory Pass and N/A decisions require an evidence reference or
approved justification, and issue workflows adapt to the record type (for
example RFI versus NCR).

## Safety and engineering boundary

The included project is demonstration data. DetourOps does not replace the
approved TDP/TMP, contract documents, authority requirements, engineering
judgment, field verification, or formal consultant/authority acceptance.
Mandatory evidence gaps are treated as hold points.

The Code Assistant is deliberately locked until an approved corpus and a live
retrieval service are connected. It must answer only from retrieved passages,
show source/edition/section/page citations, abstain when evidence is missing,
and never present retrieval output as design approval.

## Public demonstration

The live link is an interview and portfolio demonstration. Its sample records
are fictional, and browser-local fallback is available for exploring the
workflow. Do not enter confidential project, client, authority, or personal
information in the public demonstration.

## Technical shape

- Next.js-compatible UI on vinext
- Cloudflare D1 binding `DB` for private user workspaces and audit events
- Cloudflare R2 binding `FILES` for evidence and approved source files
- Sign in with ChatGPT headers for user-scoped writes
- Drizzle migrations under `drizzle/`
- Browser-local fallback for interview/demo use

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
npm test
```

Node.js `>=22.13.0` is required.
