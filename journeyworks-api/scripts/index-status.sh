#!/bin/bash
# index-status.sh - Show Elasticsearch index status
#
# Usage:
#   ./scripts/index-status.sh           # Show status of all indices
#   ./scripts/index-status.sh customers # Show status of specific index

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/.."

# Color codes
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Elasticsearch Index Status                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js first.${NC}"
    exit 1
fi

# Default to --all if no arguments
if [ $# -eq 0 ]; then
    npx ts-node scripts/es-indices.ts status --all
else
    npx ts-node scripts/es-indices.ts status "$@"
fi
