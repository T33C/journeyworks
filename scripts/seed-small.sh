#!/bin/bash
# seed-small.sh - Seed small synthetic dataset for JourneyWorks
#
# Generates: 10 customers, ~50 communications
# Use for quick testing and development

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/seed.sh" small
