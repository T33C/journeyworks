#!/bin/bash
# check-ports.sh - Verify JourneyWorks ports are available

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "JourneyWorks Port Availability Check"
echo "========================================"
echo ""

# Default ports (can be overridden by .env)
if [ -f .env ]; then
    source .env
fi

PORTS=(
    "${JOURNEYWORKS_UI_PORT:-4280}:journeyworks-ui"
    "${JOURNEYWORKS_API_PORT:-3080}:journeyworks-api"
    "${MODEL_SERVICE_PORT:-8080}:model-service"
    "${ANALYSIS_SERVICE_PORT:-8081}:analysis-service"
    "${ELASTICSEARCH_PORT:-9280}:elasticsearch"
    "${KIBANA_PORT:-5680}:kibana"
    "${REDIS_PORT:-6380}:redis"
)

all_available=true

for port_service in "${PORTS[@]}"; do
    port="${port_service%%:*}"
    service="${port_service##*:}"
    
    # Check if port is in use
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${RED}✗ Port $port ($service) - IN USE${NC}"
        echo "  Process: $(lsof -i :$port | tail -1 | awk '{print $1, $2}')"
        all_available=false
    else
        echo -e "${GREEN}✓ Port $port ($service) - Available${NC}"
    fi
done

echo ""
echo "========================================"

if [ "$all_available" = true ]; then
    echo -e "${GREEN}All ports are available!${NC}"
    echo "Run: docker-compose up -d"
else
    echo -e "${YELLOW}Some ports are in use.${NC}"
    echo ""
    echo "Options:"
    echo "1. Stop the conflicting services"
    echo "2. Edit .env to use different ports"
    echo ""
    echo "Example to change a port in .env:"
    echo "  JOURNEYWORKS_API_PORT=3081"
fi

echo "========================================"
