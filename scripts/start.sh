#!/bin/bash
# start.sh - Start JourneyWorks services
#
# Usage:
#   ./start.sh              # Start infrastructure only (ES + Redis)
#   ./start.sh --full       # Start all services (infrastructure + API + ML)
#   ./start.sh --dev        # Start infrastructure and run API in dev mode
#   ./start.sh --dev-full   # Start infra + ML services, then run API in dev mode
#   ./start.sh --ml         # Start infrastructure + ML services (Docker)
#   ./start.sh --model      # Start infrastructure + model service (Docker) for embeddings
#   ./start.sh --debug      # Start with Kibana for debugging

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_ROOT"

# Parse arguments
MODE="infra"
PROFILE=""
DEV_MODE=false
INCLUDE_ML=false
START_MODEL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --full)
            MODE="full"
            shift
            ;;
        --dev)
            MODE="dev"
            DEV_MODE=true
            shift
            ;;
        --dev-full)
            MODE="dev-full"
            DEV_MODE=true
            INCLUDE_ML=true
            shift
            ;;
        --ml)
            MODE="ml"
            PROFILE="--profile ml"
            shift
            ;;
        --model)
            START_MODEL=true
            shift
            ;;
        --debug)
            PROFILE="--profile debug"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --full      Start all services (infrastructure + API + ML via Docker)"
            echo "  --dev       Start infrastructure and run API in dev mode locally"
            echo "  --dev-full  Start infra + ML services (Docker), then run API in dev mode"
            echo "  --ml        Start infrastructure + ML services via Docker"
            echo "  --model     Start infrastructure + model service (Docker) for embeddings"
            echo "  --debug     Include Kibana for Elasticsearch debugging"
            echo "  -h,--help   Show this help message"
            echo ""
            echo "Default: Start infrastructure only (Elasticsearch + Redis)"
            echo ""
            echo "Services:"
            echo "  Infrastructure: Elasticsearch (9280), Redis (6380)"
            echo "  ML Services:    Model Service (8080), Analysis Service (8081)"
            echo "  API:            NestJS API (3080)"
            echo ""
            echo "Examples:"
            echo "  ./start.sh --model --dev   # Start infra + model locally, then API in dev mode"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Header
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}          ${CYAN}JourneyWorks${NC} - Starting Services               ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Determine docker compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Check .env file
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        echo -e "${YELLOW}Creating .env from .env.example...${NC}"
        cp .env.example .env
    else
        echo -e "${YELLOW}No .env file found. Using default configuration.${NC}"
    fi
fi

# Start services based on mode
case $MODE in
    "infra")
        echo -e "${YELLOW}Starting infrastructure services...${NC}"
        echo ""
        if [ "$START_MODEL" = true ]; then
            $DOCKER_COMPOSE up -d elasticsearch redis model-service $PROFILE
        else
            $DOCKER_COMPOSE up -d elasticsearch redis $PROFILE
        fi
        ;;
    "full")
        echo -e "${YELLOW}Starting all services (infrastructure + API + ML)...${NC}"
        echo ""
        $DOCKER_COMPOSE --profile ml up -d $PROFILE
        ;;
    "ml")
        echo -e "${YELLOW}Starting infrastructure + ML services...${NC}"
        echo ""
        $DOCKER_COMPOSE up -d elasticsearch redis model-service analysis-service $PROFILE
        ;;
    "dev")
        echo -e "${YELLOW}Starting infrastructure for development...${NC}"
        echo ""
        if [ "$START_MODEL" = true ]; then
            $DOCKER_COMPOSE up -d elasticsearch redis model-service $PROFILE
        else
            $DOCKER_COMPOSE up -d elasticsearch redis $PROFILE
        fi
        ;;
    "dev-full")
        echo -e "${YELLOW}Starting infrastructure + ML services for development...${NC}"
        echo ""
        $DOCKER_COMPOSE up -d elasticsearch redis model-service analysis-service $PROFILE
        ;;
esac

# Wait for services to be healthy
echo ""
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"

wait_for_service() {
    local service=$1
    local url=$2
    local max_attempts=$3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ $service is ready${NC}"
            return 0
        fi
        echo -e "${YELLOW}  Waiting for $service... (attempt $attempt/$max_attempts)${NC}"
        sleep 3
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ $service failed to start${NC}"
    return 1
}

# Check Elasticsearch
wait_for_service "Elasticsearch" "http://localhost:9280" 30

# Check Redis
if docker exec journeyworks-redis redis-cli ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis is ready${NC}"
else
    echo -e "${RED}✗ Redis failed to start${NC}"
fi

# Check ML services if started via Docker
if [ "$MODE" = "full" ] || [ "$MODE" = "ml" ] || [ "$INCLUDE_ML" = true ]; then
    wait_for_service "Model Service" "http://localhost:8080/health" 60
    wait_for_service "Analysis Service" "http://localhost:8081/health" 30
fi

# Wait for model service if --model flag was used
if [ "$START_MODEL" = true ]; then
    echo ""
    echo -e "${YELLOW}Waiting for Model Service to be ready (this may take a few minutes on first run)...${NC}"
    wait_for_service "Model Service" "http://localhost:8080/health" 90
fi

# Check API if started in full mode
if [ "$MODE" = "full" ]; then
    wait_for_service "JourneyWorks API" "http://localhost:3080/api" 30
fi

# Summary
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                    ${GREEN}Services Started${NC}                      ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Elasticsearch:${NC}  http://localhost:9280"
echo -e "  ${CYAN}Redis:${NC}          redis://localhost:6380"

if [ "$MODE" = "ml" ] || [ "$MODE" = "full" ] || [ "$INCLUDE_ML" = true ]; then
    echo -e "  ${CYAN}Model Service:${NC}  http://localhost:8080 (Docker)"
    echo -e "  ${CYAN}Analysis:${NC}       http://localhost:8081 (Docker)"
fi

if [ "$START_MODEL" = true ] && [ "$MODE" != "ml" ] && [ "$MODE" != "full" ] && [ "$INCLUDE_ML" != true ]; then
    echo -e "  ${CYAN}Model Service:${NC}  http://localhost:8080 (Docker)"
fi

if [ "$MODE" = "full" ]; then
    echo -e "  ${CYAN}API:${NC}            http://localhost:3080/api"
    echo -e "  ${CYAN}Swagger:${NC}        http://localhost:3080/docs"
    echo -e "  ${CYAN}UI:${NC}             http://localhost:4280"
fi

# Start API in dev mode if requested
if [ "$DEV_MODE" = true ]; then
    echo ""
    echo -e "${YELLOW}Starting API in development mode...${NC}"
    echo ""
    
    cd "$PROJECT_ROOT/journeyworks-api"
    
    # Load nvm if available
    export NVM_DIR="$HOME/.nvm"
    if [ -s "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh"
        
        # Use node version from .nvmrc or default to 20
        if [ -f ".nvmrc" ]; then
            nvm use
        else
            nvm use 20 2>/dev/null || nvm use node
        fi
        
        echo -e "${GREEN}Starting NestJS API...${NC}"
        echo ""
        npm run start:dev
    else
        echo -e "${YELLOW}nvm not found. Trying with system node...${NC}"
        echo -e "${CYAN}To start the API manually, run:${NC}"
        echo -e "  cd journeyworks-api && npm run start:dev"
        echo ""
        npm run start:dev
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC} Use ${CYAN}./scripts/stop.sh${NC} to stop all services."
echo ""
