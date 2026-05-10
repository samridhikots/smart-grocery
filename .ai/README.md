# SmartGrocery AI Agents

This directory contains agent definition files and a changelog for the SmartGrocery application. Load one of these agents at the start of a new session so you don't have to re-explain context.

---

## Agents

| File | Role | Use when… |
|------|------|-----------|
| [overall-architect.md](agents/overall-architect.md) | Principal Software Architect | You want full end-to-end context: architecture, data flows, API surface, technology stack, design decisions |
| [backend-engineer.md](agents/backend-engineer.md) | Senior Backend Engineer | Working on FastAPI routes, database schema, authentication, services, data pipeline, or model serving |
| [frontend-engineer.md](agents/frontend-engineer.md) | Senior Frontend Engineer | Working on Next.js pages, React components, Tailwind styling, auth flow, API integration, or UX patterns |
| [ml-engineer.md](agents/ml-engineer.md) | Senior ML Engineer | Working with the 7 models (Ridge, XGBoost, Logistic, TabNet, IsolationForest, FP-Growth, Eco Scorer), feature engineering, or evaluation |

---

## Changelog

Tracked in [`changelog/README.md`](changelog/README.md) — a single table. Add a row and update the relevant agent file(s) for every significant change.

---

## How to Use These Agents

When starting a new Claude Code session on this project:

1. Reference the relevant agent file at the start: `@.ai/agents/frontend-engineer.md`  
   or tell the AI: *"Read .ai/agents/frontend-engineer.md before we start"*
2. The agent will have full context of the codebase, stack, patterns, and decisions
3. After completing significant work, add a row to `changelog/README.md` and update the relevant agent file

---

## Keeping Agents Up to Date

When you make a significant change, in one step:
- Add a row to `changelog/README.md`
- Update the relevant agent file(s):
  - New API endpoint → `backend-engineer.md`
  - New page or component → `frontend-engineer.md`
  - New or modified ML model → `ml-engineer.md`
  - Architectural change → `overall-architect.md`
