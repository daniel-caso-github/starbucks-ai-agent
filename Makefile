# Starbucks AI Barista - Makefile
# Usage: make <target>

.PHONY: help install build dev dev-web start prod chat lint format test test-watch test-cov test-e2e \
        seed seed-clear seed-stats chroma chroma-drinks search-test \
        docker-up docker-down docker-logs docker-ps docker-restart docker-clean \
        setup clean

# Default target
.DEFAULT_GOAL := help

# Colors for terminal output
CYAN := \033[36m
GREEN := \033[32m
YELLOW := \033[33m
RESET := \033[0m

API := pnpm --filter @starbucks/api
WEB := pnpm --filter @starbucks/web

##@ Help
help: ## Show this help message
	@echo "$(GREEN)Starbucks AI Barista - Available Commands$(RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf ""} /^[a-zA-Z_-]+:.*?##/ { printf "  $(CYAN)%-15s$(RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(YELLOW)%s$(RESET)\n", substr($$0, 5) }' $(MAKEFILE_LIST)

##@ Development
install: ## Install all dependencies
	pnpm install

build: ## Build all packages
	pnpm -r build

dev: ## Start API dev server with hot reload
	$(API) start:dev

dev-web: ## Start Vite dev server
	$(WEB) dev

start: ## Start the API
	$(API) start

prod: ## Start API in production mode
	$(API) start:prod

debug: ## Start API in debug mode
	$(API) start:debug

##@ CLI & Chat
chat: ## Start interactive chat with barista AI
	$(API) chat

chroma: ## List ChromaDB collections
	$(API) chroma

chroma-drinks: ## Show drinks collection in ChromaDB
	$(API) chroma:drinks

search-test: ## Run semantic search test
	$(API) search:test

##@ Database & Seeds
seed: ## Populate database with drinks catalog
	$(API) seed

seed-clear: ## Clear and repopulate database
	$(API) seed:clear

seed-stats: ## Show seed statistics
	$(API) seed:stats

##@ Testing
test: ## Run unit tests
	$(API) test

test-watch: ## Run tests in watch mode
	$(API) test:watch

test-cov: ## Run tests with coverage report
	$(API) test:cov

test-e2e: ## Run e2e tests (requires docker services)
	$(API) test:e2e

test-debug: ## Run tests in debug mode
	$(API) test:debug

##@ Code Quality
lint: ## Run ESLint with auto-fix (all packages)
	pnpm -r lint

format: ## Format code with Prettier (all packages)
	pnpm -r format

##@ Docker
docker-up: ## Start all Docker services
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-logs: ## Show Docker logs (follow mode)
	docker-compose logs -f

docker-logs-app: ## Show app container logs
	docker-compose logs -f app

docker-logs-web: ## Show web container logs
	docker-compose logs -f web

docker-ps: ## Show running containers
	docker-compose ps

docker-restart: ## Restart all Docker services
	docker-compose restart

docker-restart-app: ## Restart only the app container
	docker-compose restart app

docker-clean: ## Stop containers and remove volumes
	docker-compose down -v

docker-build: ## Build Docker images
	docker-compose build

docker-rebuild: ## Rebuild and restart Docker services
	docker-compose up -d --build

##@ Observability
grafana: ## Open Grafana dashboard (localhost:3001)
	@echo "Opening Grafana at http://localhost:3001 (admin/admin)"
	@open http://localhost:3001 2>/dev/null || xdg-open http://localhost:3001 2>/dev/null || echo "Visit http://localhost:3001"

prometheus: ## Open Prometheus UI (localhost:9090)
	@echo "Opening Prometheus at http://localhost:9090"
	@open http://localhost:9090 2>/dev/null || xdg-open http://localhost:9090 2>/dev/null || echo "Visit http://localhost:9090"

jaeger: ## Open Jaeger UI (localhost:16686)
	@echo "Opening Jaeger at http://localhost:16686"
	@open http://localhost:16686 2>/dev/null || xdg-open http://localhost:16686 2>/dev/null || echo "Visit http://localhost:16686"

mongo-express: ## Open Mongo Express UI (localhost:8081)
	@echo "Opening Mongo Express at http://localhost:8081 (admin/admin)"
	@open http://localhost:8081 2>/dev/null || xdg-open http://localhost:8081 2>/dev/null || echo "Visit http://localhost:8081"

##@ API
api-docs: ## Open Swagger API documentation
	@echo "Opening Swagger at http://localhost:3000/api/docs"
	@open http://localhost:3000/api/docs 2>/dev/null || xdg-open http://localhost:3000/api/docs 2>/dev/null || echo "Visit http://localhost:3000/api/docs"

health: ## Check API health
	@curl -s http://localhost:3000/api/v1/health | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/v1/health

##@ Setup & Cleanup
setup: install docker-up seed ## Full project setup (install, docker, seed)
	@echo "$(GREEN)✓ Setup complete! Run 'make chat' to start chatting or 'make dev' for API$(RESET)"

clean: ## Clean build artifacts and node_modules
	rm -rf packages/api/dist packages/api/node_modules packages/web/dist packages/web/node_modules packages/shared/dist node_modules coverage

reset: docker-clean clean ## Full reset (remove containers, volumes, and node_modules)
	@echo "$(YELLOW)Project reset complete. Run 'make setup' to start fresh.$(RESET)"
