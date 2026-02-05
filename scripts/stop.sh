#!/bin/bash
# stop.sh - Stop JourneyWorks services
#
# Usage:
#   ./stop.sh              # Stop all running containers
#   ./stop.sh --volumes    # Stop and remove volumes (data will be lost!)
#   ./stop.sh --clean      # Stop, remove volumes, and prune images

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
REMOVE_VOLUMES=false
CLEAN_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --volumes|-v)
            REMOVE_VOLUMES=true
            shift
            ;;
        --clean|-c)
            REMOVE_VOLUMES=true
            CLEAN_ALL=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --volumes, -v  Remove data volumes (Elasticsearch, Redis data)"
            echo "  --clean, -c    Remove volumes and prune unused images"
            echo "  -h, --help     Show this help message"
            echo ""
            echo "Default: Stop all containers without removing data"
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
echo -e "${BLUE}║${NC}          ${CYAN}JourneyWorks${NC} - Stopping Services               ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Determine docker compose command
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop any local Node.js processes (API running in dev mode)
echo -e "${YELLOW}Checking for local Node.js API processes...${NC}"
API_PIDS=$(pgrep -f "nest start" 2>/dev/null || true)
if [ -n "$API_PIDS" ]; then
    echo -e "${YELLOW}Stopping local API processes: $API_PIDS${NC}"
    kill $API_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Local API processes stopped${NC}"
else
    echo -e "${GREEN}✓ No local API processes running${NC}"
fi

# Check for local Python processes (uvicorn for model/analysis services)
echo -e "${YELLOW}Checking for local Python service processes...${NC}"
PYTHON_PIDS=$(pgrep -f "uvicorn.*main:app" 2>/dev/null || true)
if [ -n "$PYTHON_PIDS" ]; then
    echo -e "${YELLOW}Stopping local Python services: $PYTHON_PIDS${NC}"
    kill $PYTHON_PIDS 2>/dev/null || true
    echo -e "${GREEN}✓ Local Python services stopped${NC}"
else
    echo -e "${GREEN}✓ No local Python services running${NC}"
fi

# Check for model service started via start.sh --model
if [ -f /tmp/journeyworks-model-service.pid ]; then
    MODEL_PID=$(cat /tmp/journeyworks-model-service.pid 2>/dev/null)
    if [ -n "$MODEL_PID" ] && ps -p $MODEL_PID > /dev/null 2>&1; then
        echo -e "${YELLOW}Stopping local model service (PID: $MODEL_PID)...${NC}"
        kill $MODEL_PID 2>/dev/null || true
        echo -e "${GREEN}✓ Local model service stopped${NC}"
    fi
    rm -f /tmp/journeyworks-model-service.pid
fi

# Stop Docker containers
echo ""
echo -e "${YELLOW}Stopping Docker containers...${NC}"

if [ "$REMOVE_VOLUMES" = true ]; then
    echo -e "${RED}Warning: This will remove all data volumes!${NC}"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        $DOCKER_COMPOSE down -v --remove-orphans
        echo -e "${GREEN}✓ Containers and volumes removed${NC}"
    else
        echo -e "${YELLOW}Cancelled. Stopping containers only...${NC}"
        $DOCKER_COMPOSE down --remove-orphans
        echo -e "${GREEN}✓ Containers stopped${NC}"
    fi
else
    $DOCKER_COMPOSE down --remove-orphans
    echo -e "${GREEN}✓ Containers stopped${NC}"
fi

# Clean up if requested
if [ "$CLEAN_ALL" = true ]; then
    echo ""
    echo -e "${YELLOW}Cleaning up unused Docker resources...${NC}"
    docker system prune -f
    echo -e "${GREEN}✓ Docker resources cleaned${NC}"
fi

# Show remaining containers
echo ""
REMAINING=$(docker ps --filter "name=journeyworks" --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$REMAINING" ]; then
    echo -e "${YELLOW}Remaining containers:${NC}"
    echo "$REMAINING"
else
    echo -e "${GREEN}All JourneyWorks containers stopped.${NC}"
fi

# Show remaining volumes
if [ "$REMOVE_VOLUMES" = false ]; then
    echo ""
    VOLUMES=$(docker volume ls --filter "name=journeyworks" --format "{{.Name}}" 2>/dev/null || true)
    if [ -n "$VOLUMES" ]; then
        echo -e "${CYAN}Data volumes preserved:${NC}"
        echo "$VOLUMES"
        echo ""
        echo -e "${YELLOW}Use ${NC}./scripts/stop.sh --volumes${YELLOW} to remove data${NC}"
    fi
fi

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
