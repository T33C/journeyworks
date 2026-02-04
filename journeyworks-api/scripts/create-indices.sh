#!/bin/bash
# create-indices.sh - Create all Elasticsearch indices
#
# Usage:
#   ./scripts/create-indices.sh              # Create missing indices
#   ./scripts/create-indices.sh --force      # Recreate all indices (deletes existing)
#   ./scripts/create-indices.sh customers    # Create specific index

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Elasticsearch Index Creator                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js first.${NC}"
    exit 1
fi

# Parse arguments
FORCE=""
INDICES=""
for arg in "$@"; do
    if [ "$arg" = "--force" ]; then
        FORCE="--force"
    else
        INDICES="$INDICES $arg"
    fi
done

# If no indices specified, create all
if [ -z "$INDICES" ]; then
    INDICES="--all"
fi

# Run the TypeScript script
echo -e "${YELLOW}Creating Elasticsearch indices...${NC}"
echo ""

npx ts-node scripts/es-indices.ts create $INDICES $FORCE

echo ""
echo -e "${GREEN}Done!${NC}"
