#!/bin/bash
# seed.sh - Seed synthetic data for JourneyWorks
#
# Usage:
#   ./seed.sh              # Medium dataset (50 customers, ~500 communications)
#   ./seed.sh small        # Small dataset (10 customers, ~50 communications)
#   ./seed.sh large        # Large dataset (100 customers, ~2000 communications)
#   ./seed.sh --keep-existing-data        # Keep existing data (default clears first)
#   ./seed.sh --with-embeddings           # Generate vector embeddings after seeding
#   ./seed.sh small --keep-existing-data  # Small dataset, keep existing
#   ./seed.sh large --with-embeddings     # Large dataset with embeddings

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
API_DIR="$PROJECT_ROOT/journeyworks-api"

echo -e "${CYAN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        JourneyWorks Data Seeder                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Parse arguments
KEEP_EXISTING=false
SIZE="medium"
GENERATE_EMBEDDINGS=false

for arg in "$@"; do
    case "$arg" in
        --keep-existing-data)
            KEEP_EXISTING=true
            ;;
        --with-embeddings)
            GENERATE_EMBEDDINGS=true
            ;;
        small|medium|large)
            SIZE="$arg"
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            echo -e "${YELLOW}Usage: ./seed.sh [small|medium|large] [--keep-existing-data] [--with-embeddings]${NC}"
            exit 1
            ;;
    esac
done

# Load nvm
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
else
    echo -e "${RED}Error: nvm not found. Please install nvm first.${NC}"
    exit 1
fi

# Use Node 20
echo -e "${BLUE}Setting Node.js version...${NC}"
nvm use 20 || {
    echo -e "${YELLOW}Node 20 not installed. Installing...${NC}"
    nvm install 20
    nvm use 20
}
echo -e "${GREEN}✓ Using Node $(node -v)${NC}"
echo ""

# Check if API is running
check_api() {
    curl -s http://localhost:3080/api > /dev/null 2>&1
    return $?
}

if ! check_api; then
    echo -e "${RED}Error: API is not running on port 3080${NC}"
    echo -e "${YELLOW}Please start the API first with: ./scripts/start.sh --dev${NC}"
    exit 1
fi

echo -e "${GREEN}✓ API is running${NC}"
echo ""

# Clear existing data unless --keep-existing-data is specified
if [ "$KEEP_EXISTING" = false ]; then
    echo -e "${YELLOW}Clearing existing data...${NC}"
    CLEAR_RESULT=$(curl -s -X DELETE http://localhost:3080/api/synthetic/clear)
    # Parse all entity counts from the response
    CUST_COUNT=$(echo "$CLEAR_RESULT" | grep -o '"customers":[0-9]*' | grep -o '[0-9]*' || echo "0")
    COMM_COUNT=$(echo "$CLEAR_RESULT" | grep -o '"communications":[0-9]*' | grep -o '[0-9]*' || echo "0")
    CASE_COUNT=$(echo "$CLEAR_RESULT" | grep -o '"cases":[0-9]*' | grep -o '[0-9]*' || echo "0")
    SOCIAL_COUNT=$(echo "$CLEAR_RESULT" | grep -o '"socialMentions":[0-9]*' | grep -o '[0-9]*' || echo "0")
    echo -e "${GREEN}✓ Cleared data: ${CUST_COUNT} customers, ${COMM_COUNT} communications, ${CASE_COUNT} cases, ${SOCIAL_COUNT} social mentions${NC}"
    echo ""
else
    echo -e "${YELLOW}Keeping existing data (--keep-existing-data flag set)${NC}"
    echo ""
fi

# Determine seed size
case "$SIZE" in
    small)
        echo -e "${BLUE}Seeding SMALL dataset (10 customers, ~50 communications)...${NC}"
        SEED_ARG="small"
        ;;
    large)
        echo -e "${BLUE}Seeding LARGE dataset (100 customers, ~2000 communications)...${NC}"
        SEED_ARG="large"
        ;;
    medium|"")
        echo -e "${BLUE}Seeding MEDIUM dataset (50 customers, ~500 communications)...${NC}"
        SEED_ARG=""
        ;;
esac

echo ""

# Change to API directory and run seed
cd "$API_DIR"

if [ -n "$SEED_ARG" ]; then
    npm run seed:$SEED_ARG
else
    npm run seed
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        Data seeding complete!                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Generate embeddings if requested
if [ "$GENERATE_EMBEDDINGS" = true ]; then
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Generating Vector Embeddings             ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check if model service is available
    MODEL_HEALTH=$(curl -s http://localhost:8080/health 2>/dev/null)
    if [ -z "$MODEL_HEALTH" ]; then
        echo -e "${RED}Error: Model service is not running on port 8080${NC}"
        echo -e "${YELLOW}Start it with: cd python/model-service && ./run.sh${NC}"
        echo -e "${YELLOW}Skipping embedding generation.${NC}"
    else
        # Get initial count
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
        echo ""
        
        if [ "$NEED_EMBEDDINGS" -gt 0 ]; then
            # Process in batches of 100 for visible progress
            BATCH_SIZE=100
            PROCESSED=0
            
            while [ "$PROCESSED" -lt "$NEED_EMBEDDINGS" ]; do
                # Generate a batch
                RESPONSE=$(curl -s -X POST "http://localhost:3080/api/communications/embeddings/bulk" \
                    -H "Content-Type: application/json" \
                    -d "{\"limit\": $BATCH_SIZE}" 2>/dev/null)
                
                # Check for error
                if echo "$RESPONSE" | grep -q '"error"'; then
                    echo -e "${RED}Error generating embeddings: $RESPONSE${NC}"
                    break
                fi
                
                # Get updated counts
                COUNTS=$(get_embedding_counts)
                CURRENT_WITH=$(echo $COUNTS | cut -d' ' -f1)
                NEWLY_PROCESSED=$((CURRENT_WITH - INITIAL_WITH))
                
                # Calculate progress
                PERCENT=$((NEWLY_PROCESSED * 100 / NEED_EMBEDDINGS))
                
                # Progress bar
                BAR_WIDTH=40
                FILLED=$((PERCENT * BAR_WIDTH / 100))
                EMPTY=$((BAR_WIDTH - FILLED))
                BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')
                
                printf "\r${CYAN}Progress: [${BAR}] ${PERCENT}%% (${CURRENT_WITH}/${TOTAL_DOCS})${NC}"
                
                # Check if we're done
                if [ "$CURRENT_WITH" -ge "$TOTAL_DOCS" ]; then
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
            done
            
            echo ""
            echo ""
            
            # Final count
            COUNTS=$(get_embedding_counts)
            FINAL_WITH=$(echo $COUNTS | cut -d' ' -f1)
            GENERATED=$((FINAL_WITH - INITIAL_WITH))
            
            echo -e "${GREEN}✓ Generated embeddings for ${GENERATED} communications${NC}"
            echo -e "${GREEN}✓ Total with embeddings: ${FINAL_WITH}/${TOTAL_DOCS}${NC}"
        else
            echo -e "${GREEN}✓ All communications already have embeddings${NC}"
        fi
        echo ""
    fi
fi

echo -e "${CYAN}Generated data includes:${NC}"
echo -e "  • Customers with varying tiers (platinum, gold, silver, bronze)"
echo -e "  • Communications across channels (email, phone, chat, social)"
echo -e "  • AI classifications with categories and regulatory flags"
echo -e "  • Message threads for email and chat conversations"
echo -e "  • Cases linked to customers"
echo -e "  • Social media mentions"
echo -e "  • Timeline events (outages, launches, policy changes)"
echo -e "  • NPS Surveys per journey stage (for journey chart)"
if [ "$GENERATE_EMBEDDINGS" = true ]; then
    echo -e "  • ${GREEN}Vector embeddings for semantic search${NC}"
fi
echo ""
if [ "$GENERATE_EMBEDDINGS" = false ]; then
    echo -e "${YELLOW}Tip: Add --with-embeddings to generate vector embeddings for semantic search${NC}"
fi
echo -e "${YELLOW}View the data at: http://localhost:4200${NC}"
