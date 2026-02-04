#!/bin/bash
# setup-dev.sh - Set up development environment for JourneyWorks

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo -e "${BLUE}========================================"
echo "JourneyWorks Development Setup"
echo -e "========================================${NC}"
echo ""

# Check for required tools
echo -e "${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✓ $1 is installed${NC}"
        return 0
    else
        echo -e "${RED}✗ $1 is not installed${NC}"
        return 1
    fi
}

check_command node || { echo "Please install Node.js 20+"; exit 1; }
check_command npm || { echo "Please install npm"; exit 1; }
check_command docker || { echo "Please install Docker"; exit 1; }
check_command docker-compose || echo -e "${YELLOW}Note: docker-compose not found, using 'docker compose' instead${NC}"

echo ""

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js version 18+ required. Current: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js version: $(node -v)${NC}"

echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✓ .env created${NC}"
    echo -e "${YELLOW}  ⚠ Please edit .env and add your API keys${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
echo ""

echo -e "${BLUE}Installing journeyworks-api dependencies...${NC}"
cd journeyworks-api
npm install
cd ..

echo ""
echo -e "${BLUE}Installing journeyworks-ui dependencies...${NC}"
cd journeyworks-ui
npm install
cd ..

echo ""

# Check ports
echo -e "${YELLOW}Checking port availability...${NC}"
./scripts/check-ports.sh

echo ""
echo -e "${GREEN}========================================"
echo "Setup Complete!"
echo -e "========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env with your API keys:"
echo "   - ANTHROPIC_API_KEY"
echo "   - OPENAI_API_KEY"
echo ""
echo "2. Start infrastructure:"
echo "   docker-compose up -d elasticsearch redis"
echo ""
echo "3. Start Python services:"
echo "   docker-compose up -d model-service analysis-service"
echo ""
echo "4. Start API (development mode):"
echo "   cd journeyworks-api && npm run start:dev"
echo ""
echo "5. Start UI (development mode):"
echo "   cd journeyworks-ui && ng serve --port 4280"
echo ""
echo "Or start everything with Docker:"
echo "   docker-compose up -d"
echo ""
