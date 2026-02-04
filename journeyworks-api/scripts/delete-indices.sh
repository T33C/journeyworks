#!/bin/bash
# delete-indices.sh - Delete Elasticsearch indices
#
# Usage:
#   ./scripts/delete-indices.sh --all        # Delete all indices
#   ./scripts/delete-indices.sh customers    # Delete specific index

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
echo -e "${CYAN}║     Elasticsearch Index Deleter                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if ts-node is available
if ! command -v npx &> /dev/null; then
    echo -e "${RED}Error: npx not found. Please install Node.js first.${NC}"
    exit 1
fi

# Require explicit arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}Error: Please specify indices to delete or use --all${NC}"
    echo ""
    echo "Usage:"
    echo "  ./scripts/delete-indices.sh --all        # Delete all indices"
    echo "  ./scripts/delete-indices.sh customers    # Delete specific index"
    exit 1
fi

# Warn for --all
if [ "$1" = "--all" ]; then
    echo -e "${RED}⚠️  WARNING: This will delete ALL Elasticsearch indices!${NC}"
    echo ""
    read -p "Are you sure you want to continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
fi

# Run the TypeScript script
echo ""
echo -e "${YELLOW}Deleting Elasticsearch indices...${NC}"
echo ""

npx ts-node scripts/es-indices.ts delete "$@"

echo ""
echo -e "${GREEN}Done!${NC}"
