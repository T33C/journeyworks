#!/bin/bash
# generate-embeddings.sh - Generate vector embeddings for communications
#
# Usage:
#   ./generate-embeddings.sh          # Generate for all documents without embeddings
#   ./generate-embeddings.sh --limit 100  # Generate for up to 100 documents
#
# Prerequisites:
#   - API running on port 3080
#   - Model service running on port 8080
#   - Elasticsearch running on port 9280

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse arguments
LIMIT=""
for arg in "$@"; do
    case "$arg" in
        --limit)
            shift
            LIMIT="$1"
            ;;
        --limit=*)
            LIMIT="${arg#*=}"
            ;;
        [0-9]*)
            if [ -z "$LIMIT" ]; then
                LIMIT="$arg"
            fi
            ;;
        -h|--help)
            echo "Usage: $0 [--limit N]"
            echo ""
            echo "Generate vector embeddings for communications in Elasticsearch."
            echo ""
            echo "Options:"
            echo "  --limit N    Maximum number of documents to process"
            echo "  -h, --help   Show this help message"
            exit 0
            ;;
    esac
done

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     JourneyWorks Embedding Generator           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if API is running
if ! curl -s http://localhost:3080/api > /dev/null 2>&1; then
    echo -e "${RED}Error: API is not running on port 3080${NC}"
    echo -e "${YELLOW}Start it with: ./scripts/start.sh --dev${NC}"
    exit 1
fi
echo -e "${GREEN}✓ API is running${NC}"

# Check if model service is running
MODEL_HEALTH=$(curl -s http://localhost:8080/health 2>/dev/null)
if [ -z "$MODEL_HEALTH" ]; then
    echo -e "${RED}Error: Model service is not running on port 8080${NC}"
    echo -e "${YELLOW}Start it with: cd python/model-service && ./run.sh${NC}"
    exit 1
fi

# Parse model info
MODELS=$(echo "$MODEL_HEALTH" | grep -o '"models_loaded":\[[^]]*\]' | sed 's/"models_loaded":\[//' | sed 's/\]//' | tr ',' ' ')
DEVICE=$(echo "$MODEL_HEALTH" | grep -o '"compute_device":"[^"]*"' | sed 's/"compute_device":"//' | sed 's/"//')
echo -e "${GREEN}✓ Model service is running (device: ${DEVICE})${NC}"
echo ""

# Get embedding counts
get_embedding_counts() {
    TOTAL=$(curl -s "http://localhost:9280/journeyworks_communications/_count" 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
    WITH_EMBEDDINGS=$(curl -s "http://localhost:9280/journeyworks_communications/_count" \
        -H "Content-Type: application/json" \
        -d '{"query":{"exists":{"field":"embedding"}}}' 2>/dev/null | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
    echo "$WITH_EMBEDDINGS $TOTAL"
}

COUNTS=$(get_embedding_counts)
INITIAL_WITH=$(echo $COUNTS | cut -d' ' -f1)
TOTAL_DOCS=$(echo $COUNTS | cut -d' ' -f2)
NEED_EMBEDDINGS=$((TOTAL_DOCS - INITIAL_WITH))

echo -e "${CYAN}Communications in index: ${TOTAL_DOCS}${NC}"
echo -e "${CYAN}Already have embeddings: ${INITIAL_WITH}${NC}"
echo -e "${CYAN}Need embeddings: ${NEED_EMBEDDINGS}${NC}"

if [ -n "$LIMIT" ]; then
    if [ "$LIMIT" -lt "$NEED_EMBEDDINGS" ]; then
        NEED_EMBEDDINGS=$LIMIT
        echo -e "${CYAN}Will process (limited): ${NEED_EMBEDDINGS}${NC}"
    fi
fi
echo ""

if [ "$NEED_EMBEDDINGS" -eq 0 ]; then
    echo -e "${GREEN}✓ All communications already have embeddings${NC}"
    exit 0
fi

# Start time for ETA calculation
START_TIME=$(date +%s)

# Process in batches for visible progress
BATCH_SIZE=100
if [ -n "$LIMIT" ] && [ "$LIMIT" -lt "$BATCH_SIZE" ]; then
    BATCH_SIZE=$LIMIT
fi
PROCESSED=0
STALL_COUNT=0
TARGET=$NEED_EMBEDDINGS

echo -e "${BLUE}Generating embeddings...${NC}"
echo ""

while [ "$PROCESSED" -lt "$TARGET" ]; do
    # Calculate batch size for this iteration
    REMAINING=$((TARGET - PROCESSED))
    if [ "$REMAINING" -lt "$BATCH_SIZE" ]; then
        CURRENT_BATCH=$REMAINING
    else
        CURRENT_BATCH=$BATCH_SIZE
    fi
    
    # Generate a batch
    RESPONSE=$(curl -s -X POST "http://localhost:3080/api/communications/embeddings/bulk" \
        -H "Content-Type: application/json" \
        -d "{\"limit\": $CURRENT_BATCH}" 2>/dev/null)
    
    # Check for error
    if echo "$RESPONSE" | grep -q '"error"'; then
        echo -e "\n${RED}Error generating embeddings: $RESPONSE${NC}"
        exit 1
    fi
    
    # Get updated counts
    COUNTS=$(get_embedding_counts)
    CURRENT_WITH=$(echo $COUNTS | cut -d' ' -f1)
    NEWLY_PROCESSED=$((CURRENT_WITH - INITIAL_WITH))
    
    # Calculate progress
    PERCENT=$((NEWLY_PROCESSED * 100 / TARGET))
    if [ "$PERCENT" -gt 100 ]; then
        PERCENT=100
    fi
    
    # Calculate ETA
    ELAPSED=$(($(date +%s) - START_TIME))
    if [ "$NEWLY_PROCESSED" -gt 0 ] && [ "$ELAPSED" -gt 0 ]; then
        REMAINING=$((TARGET - NEWLY_PROCESSED))
        if [ "$REMAINING" -lt 0 ]; then
            REMAINING=0
        fi
        RATE=$(echo "scale=2; $NEWLY_PROCESSED / $ELAPSED" | bc 2>/dev/null || echo "0")
        if [ "$RATE" != "0" ] && [ -n "$RATE" ]; then
            ETA_SECS=$(echo "scale=0; $REMAINING / $RATE" | bc 2>/dev/null || echo "?")
            if [ "$ETA_SECS" != "?" ]; then
                ETA_MIN=$((ETA_SECS / 60))
                ETA_SEC=$((ETA_SECS % 60))
                ETA_STR="${ETA_MIN}m ${ETA_SEC}s"
            else
                ETA_STR="calculating..."
            fi
        else
            ETA_STR="calculating..."
        fi
    else
        ETA_STR="calculating..."
    fi
    
    # Progress bar
    BAR_WIDTH=40
    FILLED=$((PERCENT * BAR_WIDTH / 100))
    EMPTY=$((BAR_WIDTH - FILLED))
    BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')
    
    printf "\r${CYAN}Progress: [${BAR}] ${PERCENT}%% (${NEWLY_PROCESSED}/${TARGET}) ETA: ${ETA_STR}${NC}    "
    
    # Check if we're done
    if [ "$NEWLY_PROCESSED" -ge "$TARGET" ]; then
        break
    fi
    
    # Check if no progress (avoid infinite loop)
    if [ "$NEWLY_PROCESSED" -eq "$PROCESSED" ]; then
        STALL_COUNT=$((STALL_COUNT + 1))
        if [ "$STALL_COUNT" -gt 2 ]; then
            echo ""
            echo -e "${YELLOW}No new embeddings generated. May have reached the end.${NC}"
            break
        fi
    else
        STALL_COUNT=0
    fi
    
    PROCESSED=$NEWLY_PROCESSED
    
    # Early exit if target reached
    if [ "$PROCESSED" -ge "$TARGET" ]; then
        break
    fi
done

echo ""
echo ""

# Final count
COUNTS=$(get_embedding_counts)
FINAL_WITH=$(echo $COUNTS | cut -d' ' -f1)
GENERATED=$((FINAL_WITH - INITIAL_WITH))
ELAPSED=$(($(date +%s) - START_TIME))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Embedding Generation Complete!          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Summary:${NC}"
echo -e "  • Generated embeddings: ${GREEN}${GENERATED}${NC}"
echo -e "  • Total with embeddings: ${FINAL_WITH}/${TOTAL_DOCS}"
echo -e "  • Time elapsed: ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
if [ "$ELAPSED" -gt 0 ] && [ "$GENERATED" -gt 0 ]; then
    RATE=$(echo "scale=2; $GENERATED / $ELAPSED" | bc 2>/dev/null || echo "?")
    echo -e "  • Rate: ~${RATE} docs/sec"
fi
echo ""
