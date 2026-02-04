#!/bin/bash
# seed-large.sh - Seed large synthetic dataset for JourneyWorks
#
# Generates: 100 customers, ~2000 communications
# Use for performance testing and realistic demos

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/seed.sh" large
