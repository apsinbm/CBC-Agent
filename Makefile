# CBC Analytics Platform Makefile

.PHONY: help up down build logs seed clean test

help: ## Show this help message
	@echo "CBC Analytics Platform - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Start all services with Docker Compose
	docker-compose up -d
	@echo "Services starting..."
	@echo "Admin UI: http://localhost:3001"
	@echo "Ingest API: http://localhost:8001/docs"
	@echo "PostgreSQL: localhost:5432"

down: ## Stop all services
	docker-compose down

build: ## Build all Docker images
	docker-compose build

logs: ## View logs for all services
	docker-compose logs -f

logs-api: ## View logs for ingest API
	docker-compose logs -f ingest-api

logs-admin: ## View logs for admin UI
	docker-compose logs -f admin-ui

logs-dbt: ## View logs for dbt
	docker-compose logs -f dbt

seed: ## Generate seed data (requires services to be running)
	@echo "Generating seed data..."
	python3 scripts/seed_data.py

dbt-run: ## Run dbt transformations
	docker-compose run --rm dbt dbt run

dbt-test: ## Run dbt tests
	docker-compose run --rm dbt dbt test

dbt-docs: ## Generate dbt documentation
	docker-compose run --rm dbt dbt docs generate
	docker-compose run --rm -p 8080:8080 dbt dbt docs serve --port 8080

clean: ## Clean up volumes and containers
	docker-compose down -v
	rm -rf packages/admin-ui/.next
	rm -rf packages/admin-ui/node_modules
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

test-api: ## Run API tests
	docker-compose run --rm ingest-api pytest tests/

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	python3 scripts/test_integration.py

dev-api: ## Run API in development mode (hot reload)
	cd packages/ingest-api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

dev-admin: ## Run admin UI in development mode
	cd packages/admin-ui && npm run dev

install-local: ## Install dependencies for local development
	cd packages/ingest-api && pip install -r requirements.txt
	cd packages/admin-ui && npm install
	cd packages/analytics-dbt && pip install dbt-core dbt-postgres

db-shell: ## Connect to PostgreSQL shell
	docker-compose exec postgres psql -U cbc -d cbc_analytics

redis-cli: ## Connect to Redis CLI
	docker-compose exec redis redis-cli

backup: ## Backup database
	@mkdir -p backups
	docker-compose exec postgres pg_dump -U cbc cbc_analytics > backups/backup_$$(date +%Y%m%d_%H%M%S).sql
	@echo "Backup saved to backups/"

restore: ## Restore database from latest backup
	@latest=$$(ls -t backups/*.sql | head -1); \
	if [ -z "$$latest" ]; then \
		echo "No backup found"; \
	else \
		echo "Restoring from $$latest"; \
		docker-compose exec -T postgres psql -U cbc cbc_analytics < $$latest; \
	fi

status: ## Check status of all services
	@echo "Service Status:"
	@docker-compose ps
	@echo ""
	@echo "Database Tables:"
	@docker-compose exec postgres psql -U cbc -d cbc_analytics -c "\dt"

monitor: ## Open monitoring dashboard (if pgAdmin is running)
	@echo "Opening pgAdmin at http://localhost:5050"
	@echo "Login: admin@cbc.bm / admin"
	@open http://localhost:5050 2>/dev/null || xdg-open http://localhost:5050 2>/dev/null || echo "Please open http://localhost:5050"

.DEFAULT_GOAL := help