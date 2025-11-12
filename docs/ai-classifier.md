# Baseline AI Readiness Classifier

The prototype ships with a deterministic heuristic classifier that runs when
messages are ingested into the faux inbox as well as whenever reassessment is
requested. The logic lives in `ai-classifier.js` (exposed globally as
`AIClassifier` and via `window.aiAssessorAPI.reassessEmail`).

## Persisted metadata

Each email gains an `ai` object with the following shape:

- `category`: one of `green`, `blue`, `red`, or `grey`.
- `confidence`: numeric score between `0` and `1`.
- `blockers`: array of blocker codes that prevent automation.
- `required_permissions`: permissions the automation would need to proceed.
- `required_context`: pieces of missing context required before automation resumes.
- `assessed_at`: ISO timestamp of when the assessment was produced.
- `assessor_version`: classifier version string (`baseline-heuristic-v1`).
- `notes`: short human readable description summarising the outcome.

For backwards compatibility the classifier also syncs `aiCategory` and
`aiSynopsis` on each message.

## Classification rules

| Category | Triggering heuristics | Notes |
| --- | --- | --- |
| **Red** | Message status is `urgent`, `manual`, `escalated`, `error`, or the subject/body contains high‑risk words (payment, overdue, failure, manual review). | Adds `requires_human_decision` blocker, and `billing_risk` when invoices or billing are mentioned. Confidence is `0.85` and notes explain why human review is required. |
| **Blue** | Status is `needs_context`/`awaiting_context` or the content mentions missing context/offline devices. | Requires context before continuing. Adds contextual requirements such as `device_status` or `tenant_history`. Confidence is `0.70` with notes requesting additional information. |
| **Green** | Status indicates a draft or ready item, or the content mentions drafts prepared by AI. | Requests the `send_mail` permission so automation can complete the workflow. Confidence is `0.80` and notes state that the draft is ready for approval. |
| **Grey** | No other rule matched. | Minimal metadata with a `0.20` confidence score signalling that more signals are needed. |

Reassessment simply re-runs the heuristic with the latest timestamp, replacing
all AI metadata while keeping the record idempotent and auditable.
