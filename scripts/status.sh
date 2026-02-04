#!/bin/bash
# status.sh - Check status of JourneyWorks services
#
# Usage:
#   ./status.sh           # Show status of all services

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Header
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}          ${CYAN}JourneyWorks${NC} - Service Status                   ${BLUE}║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

check_service() {
    local name=$1
    local url=$2
    local port=$3
    
    if curl -s "$url" > /dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} ${name} - ${GREEN}Running${NC} (port ${port})"
        return 0
    else
        echo -e "  ${RED}○${NC} ${name} - ${RED}Not running${NC} (port ${port})"
        return 1
    fi
}

check_docker_container() {
    local name=$1
    local container=$2
    local port=$3
    
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "$container"; then
        echo -e "  ${GREEN}●${NC} ${name} - ${GREEN}Running${NC} (container: ${container})"
        return 0
    else
        echo -e "  ${RED}○${NC} ${name} - ${RED}Not running${NC}"
        return 1
    fi
}

# Infrastructure Services
echo -e "${CYAN}Infrastructure Services:${NC}"
check_service "Elasticsearch" "http://localhost:9280" "9280"
check_docker_container "Redis" "journeyworks-redis" "6380"

# ML/AI Services
echo ""
echo -e "${CYAN}ML/AI Services:${NC}"
check_service "Model Service (embeddings/reranking)" "http://localhost:8080/health" "8080"
check_service "Analysis Service (statistics)" "http://localhost:8081/health" "8081"

# Application Services
echo ""
echo -e "${CYAN}Application Services:${NC}"
check_service "NestJS API" "http://localhost:3080/api" "3080"
check_service "Angular UI" "http://localhost:4280" "4280"

# Docker containers
echo ""
echo -e "${CYAN}Docker Containers:${NC}"
CONTAINERS=$(docker ps --filter "name=journeyworks" --format "  {{.Names}}: {{.Status}}" 2>/dev/null || true)
if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS"
else
    echo -e "  ${YELLOW}No JourneyWorks containers running${NC}"
fi

# Summary
echo ""
echo -e "${CYAN}Quick Start Commands:${NC}"
echo -e "  ${YELLOW}./scripts/start.sh --dev${NC}       Infrastructure + API (dev mode)"
echo -e "  ${YELLOW}./scripts/start.sh --dev-full${NC}  Infrastructure + ML + API (dev mode)"
echo -e "  ${YELLOW}./scripts/start.sh --ml${NC}        Infrastructure + ML services"
echo -e "  ${YELLOW}./scripts/start.sh --full${NC}      All services (Docker)"
echo ""
