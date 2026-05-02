RAG_DIR   := $(HOME)/Downloads/cc-benefits-rag 2
AGENT_DIR := $(HOME)/Desktop/Work/credit-card-agent
BACK_DIR  := $(HOME)/Desktop/Work/credit_cards/backend

.PHONY: dev stop setup logs

## Start all services (backend, RAG, agent, frontend)
dev:
	@echo "Starting backend on :8000..."
	@cd "$(BACK_DIR)" && venv/bin/uvicorn app.main:app --port 8000 --reload &

	@echo "Starting RAG service on :8001..."
	@cd "$(RAG_DIR)" && venv/bin/uvicorn rag_service:app --port 8001 --reload &

	@echo "Starting agent on :8002..."
	@cd "$(AGENT_DIR)" && venv/bin/uvicorn service:app --port 8002 --reload &

	@echo "Starting frontend on :3000..."
	@npm run dev

## Kill all local service ports
stop:
	@echo "Stopping services on :8000 :8001 :8002 :3000..."
	@lsof -ti:8000,8001,8002,3000 | xargs kill -9 2>/dev/null || true
	@echo "Done."

## Create venv + install deps for the agent (run once)
setup-agent:
	@echo "Setting up credit-card-agent venv..."
	@cd "$(AGENT_DIR)" && python3 -m venv venv && venv/bin/pip install -r requirements.txt
	@echo "Done. Copy .env.example to .env and fill in keys."

## Show what's running on each port
status:
	@for port in 8000 8001 8002 3000; do \
		pid=$$(lsof -ti:$$port 2>/dev/null); \
		if [ -n "$$pid" ]; then \
			echo ":$$port → running (pid $$pid)"; \
		else \
			echo ":$$port → not running"; \
		fi; \
	done
