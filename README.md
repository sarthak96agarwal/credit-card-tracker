# Credit Cards

A full-stack credit card benefits tracker. Track what you own, what you've used, and what's about to expire — with an AI assistant that answers questions about your cards and their policies.

---

## Architecture

```
Browser (Next.js)
     │
     ├── /dashboard, /wallets, /benefits …  ← personal account data
     │         │
     │         ▼
     │   CC Backend (FastAPI, :8000)
     │         ├── /agent/*         ← agent-optimised endpoints
     │         ├── /dashboard/*     ← dashboard data
     │         ├── /wallets/*       ← currency wallets
     │         └── …
     │
     └── RAGChatWidget              ← AI chat assistant (bottom-right)
               │
               ▼
         CC Agent (Pydantic AI, :8002)
               ├── query_card_benefits_rag  →  RAG Service (:8001)
               ├── get_benefit_status       →  CC Backend /agent/benefit-status
               ├── get_cards                →  CC Backend /agent/cards
               └── get_wallet_status        →  CC Backend /agent/wallet-status
```

---

## Services

| Service | Repo | Port | Purpose |
|---|---|---|---|
| **CC Backend** | `credit_cards/backend` | 8000 | Personal account data — benefits, cards, wallets |
| **CC Benefits RAG** | `credit-cards-benefits-rag` | 8001 | Vector + BM25 hybrid retrieval over card benefit PDFs |
| **CC Agent** | `credit-cards-agent` | 8002 | Pydantic AI agent — routes questions to RAG or backend |
| **Frontend** | `credit_cards` (Next.js) | 3000 | Dashboard + AI chat widget |

---

## Running Locally

Use the root `Makefile` to start all services at once:

```bash
make dev     # starts all 4 services
make stop    # kills ports 8000, 8001, 8002, 3000
make status  # shows what's running on each port
```

Or start individually:

```bash
# Backend
cd backend && uvicorn app.main:app --port 8000 --reload

# Frontend
npm run dev
```

### Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_AGENT_URL=http://localhost:8002
```

---

## Project Structure

```
credit_cards/
├── backend/
│   └── app/
│       ├── main.py
│       ├── models/
│       ├── routers/
│       │   ├── agent.py        ← /agent/* endpoints (benefit-status, cards, wallet-status)
│       │   ├── dashboard.py
│       │   ├── wallets.py
│       │   └── …
│       └── database.py
├── src/
│   ├── app/                    ← Next.js pages
│   ├── components/
│   │   ├── RAGChatWidget.tsx   ← AI chat widget with owner picker + streaming
│   │   └── …
│   └── lib/
│       └── api.ts              ← API clients (api, ragApi, agentApi)
├── Makefile
└── .env.local
```

---

## AI Chat Widget

The `RAGChatWidget` (bottom-right of every page) is an AI assistant backed by the agent service.

**Flow:**
1. First open → owner picker (fetches `GET /owners/` to select whose data to use)
2. Ask any question → agent routes to the right tool(s):
   - Card policy, coverage limits, lounge access → RAG pipeline (PDF knowledge base)
   - Personal benefit usage, expiring balances → `/agent/benefit-status`
   - Cards owned, annual fees, multipliers → `/agent/cards`
   - Wallet balances, year-end pace → `/agent/wallet-status`
3. Answer streams in token-by-token; bouncing dots shown during the tool-call phase
4. Switch owner via the **Switch** button in the chat header
5. Full message history passed each turn for multi-turn context

---

## Backend — Agent Endpoints

Three agent-optimised endpoints under `/agent/*`. Each returns `{summary, items, metadata}` where `summary` is a pre-formatted string the agent uses directly.

| Endpoint | Returns |
|---|---|
| `GET /agent/benefit-status?owner_id=X` | Benefit usage, remaining balances, days until expiry |
| `GET /agent/cards?owner_id=X` | Cards owned, annual fees, benefits value, multipliers |
| `GET /agent/wallet-status?owner_id=X` | Currency wallet balances, year-end pace |

---

## Deployment (Railway)

Each service deploys independently on Railway. Set these env vars in the frontend service:

```
NEXT_PUBLIC_API_URL=https://<cc-backend>.up.railway.app
NEXT_PUBLIC_AGENT_URL=https://<cc-agent>.up.railway.app
```
