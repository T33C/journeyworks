# LLM Prompt Templates

This folder contains all prompt templates used by the JourneyWorks Customer Intelligence platform. Each prompt is in its own file for easy maintenance, versioning, and documentation.

## Architecture

Prompts are organized into categories based on their function:

```
prompts/
├── system/           # System prompts defining AI persona and behavior
├── analysis/         # Communication analysis prompts
├── rag/              # Retrieval-Augmented Generation prompts
├── rrg/              # Retrieval-Refined Generation (NL to DSL)
├── agent/            # Agent and tool-use prompts
├── research/         # Customer intelligence research prompts
└── index.ts          # Exports all prompts
```

## Prompt Design Principles

### 1. Structured Output

All prompts request JSON output to enable:

- Programmatic parsing of LLM responses
- Consistent data structures across the application
- Type-safe handling in TypeScript

### 2. Domain Expertise

Prompts are tailored for **investment banking customer intelligence**:

- Regulatory and compliance awareness
- Professional communication standards
- Relationship manager workflows
- Risk identification and escalation

### 3. Confidence & Citation

Prompts request:

- Confidence scores for conclusions
- Source citations for claims
- Data quality notes and limitations

### 4. Actionable Output

Every analysis prompt includes:

- Specific recommendations
- Suggested next steps
- Follow-up questions

## Template Syntax

Prompts use Handlebars-style variable interpolation:

```
{{variableName}}        - Simple substitution
{{#if condition}}...{{/if}}  - Conditional sections
```

Variables are replaced at runtime by the `PromptTemplateService`.

## Adding New Prompts

1. Create a new `.ts` file in the appropriate category folder
2. Export the prompt as a named constant
3. Add documentation explaining the prompt's purpose
4. Register in `index.ts`
5. Register in `prompt-template.service.ts`

## Prompt Categories

### System Prompts (`system/`)

Define the AI's persona and behavioral guidelines. These are passed as the `system` parameter in API calls.

| Prompt                 | Purpose                                      |
| ---------------------- | -------------------------------------------- |
| `analyst`              | General customer communications analyst      |
| `researcher`           | Research assistant for answering questions   |
| `rrg`                  | Natural language to query translator         |
| `customerIntelligence` | Deep research analyst for executive insights |

### Analysis Prompts (`analysis/`)

Analyze individual communications or collections.

| Prompt          | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `sentiment`     | Classify sentiment with emotional tone           |
| `intent`        | Identify customer intent and urgency             |
| `entity`        | Extract named entities (products, people, dates) |
| `summary`       | Generate structured summaries                    |
| `comprehensive` | Full multi-dimensional analysis                  |

### RAG Prompts (`rag/`)

Support Retrieval-Augmented Generation workflows.

| Prompt       | Purpose                                                   |
| ------------ | --------------------------------------------------------- |
| `query`      | Optimize search queries for retrieval                     |
| `answer`     | Generate answers from retrieved documents                 |
| `contextual` | Add context to document chunks (Anthropic Contextual RAG) |

### RRG Prompts (`rrg/`)

Convert natural language to Elasticsearch DSL queries.

| Prompt          | Purpose                                         |
| --------------- | ----------------------------------------------- |
| `nlToDsl`       | Translate natural language to Elasticsearch DSL |
| `dslRefinement` | Refine queries based on result quality          |

### Agent Prompts (`agent/`)

Support agentic workflows with tool use.

| Prompt     | Purpose                                 |
| ---------- | --------------------------------------- |
| `react`    | ReAct (Reasoning and Acting) agent loop |
| `research` | Research agent with available tools     |

### Research Prompts (`research/`)

Customer intelligence research and reporting.

| Prompt             | Purpose                                       |
| ------------------ | --------------------------------------------- |
| `queryEnhancement` | Transform queries for better retrieval        |
| `response`         | Structure findings into analyst-ready reports |
| `insightCard`      | Generate dashboard-ready insight cards        |
| `trend`            | Analyze time-series patterns                  |
| `customerHealth`   | Assess customer relationship health           |
| `comparative`      | Compare segments or time periods              |

## Testing Prompts

Use the RAG/research endpoints to test prompt effectiveness:

```bash
# Test RAG answer generation
curl -X POST http://localhost:3080/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What are customers saying about mobile app?", "useReranking": true}'

# Test research insight generation
curl -X POST http://localhost:3080/api/research/insight \
  -H "Content-Type: application/json" \
  -d '{"question": "Why is satisfaction declining?", "context": {...}}'
```

## Version Control

- Each prompt file has JSDoc comments with version info
- Major prompt changes should be documented in CHANGELOG
- Consider A/B testing significant prompt changes

## References

- [Anthropic Prompt Engineering Guide](https://docs.anthropic.com/claude/docs/prompt-engineering)
- [OpenAI Best Practices](https://platform.openai.com/docs/guides/prompt-engineering)
- [Anthropic Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
