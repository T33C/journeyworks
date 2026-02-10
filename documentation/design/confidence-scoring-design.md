# Confidence Scoring — Design Specification

_Future implementation guide for meaningful insight confidence scoring._

**Status:** Design · Not yet implemented  
**Priority:** Medium  
**Last updated:** 10 February 2026

---

## 1. Problem Statement

The confidence chip displayed in the research panel summary header currently provides little value:

| Source                        | How confidence is set today            | Problem                                |
| ----------------------------- | -------------------------------------- | -------------------------------------- |
| Mock insights (hardcoded)     | 10× `high`, 8× `medium`, 0× `low`      | Static — never changes                 |
| Bubble insights (client-side) | Volume ÷ average volume threshold      | Only measures sample size              |
| LLM insights (server-side)    | LLM self-selects `high`/`medium`/`low` | LLMs almost always self-rate as "high" |

The result is that analysts see **"High Confidence"** on nearly every insight, which trains them to ignore it — undermining the governance principle that confidence scoring helps analysts "know when to trust vs. verify".

---

## 2. Design Goal

Replace subjective/static confidence with a **computed score** derived from objective, measurable signals. The score should:

- Differentiate meaningfully between insights the analyst can trust and those that need verification
- Be explainable — the analyst should understand _why_ confidence is high, medium, or low
- Be consistent across all insight sources (bubble click, event click, brush range, LLM, agent)

---

## 3. Confidence Factors

Confidence should be computed as a weighted composite of five independent factors:

### 3.1 Evidence Volume (weight: 25%)

How much data underpins the insight.

| Signal                       | Score |
| ---------------------------- | ----- |
| ≥ 50 communications in scope | 1.0   |
| 20–49 communications         | 0.7   |
| 5–19 communications          | 0.4   |
| < 5 communications           | 0.1   |

**Rationale:** Small samples produce unreliable statistics. An insight based on 3 emails should not carry the same weight as one based on 200.

### 3.2 Source Diversity (weight: 20%)

How many independent source types contribute evidence.

| Sources present                                | Score |
| ---------------------------------------------- | ----- |
| 3+ types (e.g. email + call + social + survey) | 1.0   |
| 2 types                                        | 0.7   |
| 1 type only                                    | 0.3   |

**Rationale:** Cross-channel corroboration increases reliability. A sentiment signal visible in both complaints and social media is more trustworthy than one seen only in a single email thread.

### 3.3 Temporal Coverage (weight: 15%)

How much of the requested time range has data.

| Coverage                         | Score |
| -------------------------------- | ----- |
| ≥ 80% of days in range have data | 1.0   |
| 50–79%                           | 0.6   |
| < 50%                            | 0.2   |

**Rationale:** Gaps in time series can mask or fabricate trends. A "declining sentiment" insight is unreliable if 4 out of 7 days have no data.

### 3.4 Statistical Significance (weight: 25%)

Whether the observed patterns are statistically meaningful.

| Signal                                      | Score |
| ------------------------------------------- | ----- |
| Trend/anomaly has p < 0.05 or z-score > 2.0 | 1.0   |
| Moderate significance (p < 0.1 or z > 1.5)  | 0.6   |
| Weak or no statistical test applicable      | 0.3   |

**Rationale:** "Complaints increased 15%" sounds dramatic but may be random noise on a small sample. Statistical significance prevents false alerts.

**Implementation note:** For bubble insights, the standard deviation computation already exists (used for OUTLIER badges). For LLM insights, the Python analysis service returns z-scores when invoked. For cases where no statistical test runs, default to 0.3.

### 3.5 LLM Grounding (weight: 15%)

Whether the LLM's claims are traceable to provided evidence.

| Signal                                                 | Score |
| ------------------------------------------------------ | ----- |
| All key claims cite specific evidence from the context | 1.0   |
| Most claims grounded, some inferred                    | 0.6   |
| LLM appears to extrapolate beyond provided data        | 0.2   |

**Rationale:** LLMs can hallucinate plausible-sounding statistics. Grounding checks catch this.

**Implementation note:** This is the hardest factor to automate. Initial approach: count how many numbers in the LLM response appear in the input data prompt. A more robust approach would use a lightweight verification pass (a second, cheaper LLM call or rule-based check). For mock/client-side insights this factor defaults to 1.0 since all data is deterministic.

---

## 4. Composite Score Calculation

```
compositeScore = (evidenceVolume   × 0.25)
              + (sourceDiversity   × 0.20)
              + (temporalCoverage  × 0.15)
              + (statisticalSig    × 0.25)
              + (llmGrounding      × 0.15)
```

### Mapping to confidence level

| Composite Score | Level      | Colour            | Meaning                                                |
| --------------- | ---------- | ----------------- | ------------------------------------------------------ |
| ≥ 0.75          | **High**   | Green (`#00847f`) | Analyst can act on this insight with high trust        |
| 0.45 – 0.74     | **Medium** | Amber (`#ed8b00`) | Directionally useful — verify key claims before acting |
| < 0.45          | **Low**    | Red (`#a8000b`)   | Treat as a hypothesis — insufficient data to confirm   |

---

## 5. UI Enhancement — Confidence Tooltip

The confidence chip should show a **breakdown tooltip on hover** so analysts understand why:

```
┌──────────────────────────────────────┐
│  Confidence: Medium (0.58)           │
│  ──────────────────────────────────  │
│  Evidence volume    ████████░░  0.7  │
│  Source diversity   ███░░░░░░░  0.3  │
│  Temporal coverage  ██████████  1.0  │
│  Statistical sig.   ██████░░░░  0.6  │
│  LLM grounding      ███░░░░░░░  0.3  │
│  ──────────────────────────────────  │
│  ⚠ Single source type (email only)  │
│  ⚠ Some claims not traceable to     │
│    provided evidence                 │
└──────────────────────────────────────┘
```

This turns confidence from a meaningless badge into an **actionable diagnostic** — the analyst can see exactly what's weak and decide whether to investigate further.

---

## 6. Data Model Changes

### 6.1 `ResearchInsight` interface (analysis.model.ts)

```typescript
// Replace:
confidence: 'high' | 'medium' | 'low';

// With:
confidence: 'high' | 'medium' | 'low';
confidenceScore?: number;           // 0.0 – 1.0 composite
confidenceFactors?: {
  evidenceVolume: number;            // 0.0 – 1.0
  sourceDiversity: number;           // 0.0 – 1.0
  temporalCoverage: number;          // 0.0 – 1.0
  statisticalSignificance: number;   // 0.0 – 1.0
  llmGrounding: number;              // 0.0 – 1.0
  warnings?: string[];               // Human-readable explanations for low factors
};
```

The `confidence` string field is kept for backward compatibility — it is derived from `confidenceScore`.

### 6.2 API response (research.service.ts)

The `getInsight()` and `generateLlmInsightWithData()` methods should compute the factors from data already available:

- `evidenceVolume` → `insightData.summary.totalCommunications`
- `sourceDiversity` → count distinct `evidence[].type` values
- `temporalCoverage` → `insightData.timeSeries.length` ÷ expected days in range
- `statisticalSignificance` → from Python analysis service result (if called) or stddev computation
- `llmGrounding` → post-processing check on LLM response vs. input data

### 6.3 Client-side (analysis-data.service.ts)

`generateBubbleInsight()` should compute factors locally:

- `evidenceVolume` → bubble.volume vs. thresholds
- `sourceDiversity` → always 1.0 (deterministic mock data)
- `temporalCoverage` → 1.0 (single-day selection, data exists by definition)
- `statisticalSignificance` → derive from existing stddev and npsVsAvg calculations
- `llmGrounding` → 1.0 (no LLM involved)

---

## 7. Implementation Plan

| Phase       | Scope                                                                                                                                                | Effort  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| **Phase 1** | Add `confidenceScore` + `confidenceFactors` to model. Compute evidence volume and source diversity on API side. Client falls back to existing logic. | ~2 days |
| **Phase 2** | Add temporal coverage factor. Wire statistical significance from Python service results.                                                             | ~1 day  |
| **Phase 3** | Build tooltip breakdown UI component (hover on confidence chip).                                                                                     | ~1 day  |
| **Phase 4** | Implement LLM grounding check (count matched numbers).                                                                                               | ~2 days |
| **Phase 5** | Tune weights and thresholds based on real usage data.                                                                                                | Ongoing |

**Total estimated effort:** ~6 days

---

## 8. Affected Files

| File                                                                                     | Change                                                               |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `journeyworks-ui/src/app/core/models/analysis.model.ts`                                  | Add `confidenceScore`, `confidenceFactors` to `ResearchInsight`      |
| `journeyworks-ui/src/app/core/services/analysis-data.service.ts`                         | Compute factors in `generateBubbleInsight()` and mock insights       |
| `journeyworks-ui/src/app/features/analysis/research-panel/research-panel.component.html` | Add tooltip to confidence chip                                       |
| `journeyworks-ui/src/app/features/analysis/research-panel/research-panel.component.ts`   | Add `getConfidenceTooltip()` method                                  |
| `journeyworks-ui/src/app/features/analysis/research-panel/research-panel.component.scss` | Style the tooltip breakdown                                          |
| `journeyworks-api/src/modules/research/research.service.ts`                              | Compute factors in `getInsight()` and `generateLlmInsightWithData()` |
| `journeyworks-api/src/modules/research/research.types.ts`                                | Add factor types to `ResearchInsight`                                |

---

## 9. Testing Considerations

- **Low confidence must actually appear.** Seed test data with a scenario that produces low confidence (e.g. 2 emails, single channel, no time series) and verify the chip shows red/low.
- **Factor breakdown should sum correctly.** Unit test the composite calculation.
- **Backward compatibility.** Existing API consumers that only read `confidence: 'high'|'medium'|'low'` must continue to work — the new fields are optional additions.
- **LLM grounding false positives.** The number-matching heuristic will occasionally flag legitimate inferences as ungrounded. Validate against a sample of real LLM responses to calibrate thresholds.
