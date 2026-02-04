# Customer Intelligence Platform – Interactive Demo Specification

## Purpose
This document defines the **user interface, charts, interactions, and AI integration** for a clickable demo of a Customer Intelligence Platform for a bank.

The goal is to demonstrate:
- Unified analysis of complaints, sentiment, social context, and bank events
- Explainable AI-assisted research
- A single-screen “thinking workspace” for analysts and executives

This is **not** a chatbot demo and **not** a static dashboard.

---

## 1. Overall Screen Layout

### Layout Pattern
**Two-column analysis canvas**

┌───────────────────────────────────────────────────────────────┐
│ Global Filters Bar                                            │
├──────────────────────────────┬───────────────────────────────┤
│ Analysis Canvas (65%)         │ AI Research Panel (35%)        │
│                               │                               │
│ Charts and Visuals            │ Narrative AI Reasoning        │
│                               │ Evidence & Chat               │
└──────────────────────────────┴───────────────────────────────┘

### Global Filters Bar (Top)
- Date range selector
- Product selector (e.g. Cards, Loans, Savings)
- Channel filter (Complaints, Calls, Email, Social)
- Event overlay toggle
- Export / Share

Filters apply **globally** to all charts and AI responses.

---

## 2. Analysis Canvas (Left Side)

The Analysis Canvas contains **three coordinated charts**.
All charts are **linked** and respond to user interaction.

---

### 2.1 Sentiment-Weighted Event Timeline (Primary Chart)

#### Purpose
Provide an at-a-glance understanding of:
- Customer sentiment over time
- Complaint volume
- Social media sentiment
- Bank events (e.g. outages, product launches)

#### Chart Type
**Hybrid Time-Series Chart**
- X-axis: Time
- Y-axis (left): Sentiment score (-1 to +1)
- Y-axis (right): Communication volume

#### Visual Elements
1. **Complaint Volume Bubbles**
   - Positioned on timeline
   - Size = volume of communications
   - Colour = average sentiment
     - Red = negative
     - Amber = neutral
     - Green = positive

2. **Social Sentiment Band**
   - Horizontal band behind bubbles
   - Colour intensity reflects social sentiment
   - Used for early warning

3. **Event Markers**
   - Vertical lines with labels
   - e.g. “Payments Outage”, “New Card Launch”

#### Interactions
- Hover: show tooltip with volume, sentiment, top themes
- Click bubble: selects time window
- Drag / lasso: select date range
- Click event marker: focus analysis on event period

#### AI Integration
When a user interacts:
- Emit a structured context object:
```json
{
  "timeWindow": "2025-01-03 to 2025-01-06",
  "product": "Cards",
  "signal": "Sentiment drop",
  "event": "Payments outage"
}

This context is passed to the AI Research Panel.

⸻

2.2 Sentiment Journey Waterfall

Purpose
Show how sentiment changes through the customer journey.

Chart Type
Waterfall Chart

X-axis (Journey Stages)
	•	Initial Contact
	•	Triage
	•	Investigation
	•	Resolution
	•	Post-Resolution

Y-axis
	•	Average sentiment score

Visual Rules
	•	Downward bars = sentiment loss
	•	Upward bars = sentiment recovery
	•	Final bar = net sentiment outcome

Interaction
	•	Click stage → highlights related communications
	•	Selection updates AI Research Panel

⸻

2.3 Volume vs Sentiment Quadrant

Purpose
Identify high-risk and high-impact issues quickly.

Chart Type
Scatter / Quadrant Chart

Axes
	•	X-axis: Sentiment (Negative → Positive)
	•	Y-axis: Volume (Low → High)

Quadrants
	•	Top-left: High volume, negative sentiment (Critical)
	•	Bottom-left: Low volume, negative sentiment (Watch)
	•	Top-right: High volume, positive sentiment (Strength)
	•	Bottom-right: Low volume, positive sentiment (Noise)

Interaction
	•	Click quadrant → filters all charts
	•	AI explains dominant themes in that quadrant

⸻

3. AI Research Panel (Right Side)

This panel provides explainable, narrative insight.

It updates automatically based on chart interaction.

⸻

3.1 Research Summary (Always Visible)

Content
	•	Root cause summary (2–3 sentences)
	•	Key drivers (bullets)
	•	Confidence indicator (High / Medium / Low)

Example:

“The sentiment decline was primarily driven by payment failures following a processing outage, amplified by social media complaints prior to formal complaint submission.”

⸻

3.2 Evidence Section (Expandable)
	•	Top complaint excerpts
	•	Call transcript snippets
	•	Social media posts
	•	News headlines

Each item links back to:
	•	Source
	•	Timestamp
	•	Chart highlight

⸻

3.3 Timeline Reasoning (Expandable)

Explains:
	•	Lead/lag relationships
	•	Cause and effect
	•	Comparison to historical events

⸻

3.4 Chat Input (Secondary)

Purpose
Used for:
	•	Clarification
	•	“Why” questions
	•	What-if analysis

Example prompts:
	•	“Why did social sentiment lead complaints?”
	•	“Compare this to the October outage.”

Chat responses:
	•	Update the narrative
	•	Highlight chart regions
	•	Add annotations

⸻

4. AI System Behaviour (Important)

AI is:
	•	Context-driven (not free-form)
	•	Retrieval-augmented
	•	Evidence-bound

AI is NOT:
	•	Making decisions
	•	Producing insights without sources
	•	Replacing analyst judgement

AI Inputs
	•	Chart selections
	•	Filters
	•	Historical data
	•	External context (social, news)

AI Outputs
	•	Structured summaries
	•	Evidence links
	•	Confidence scoring
	•	Visual annotations

⸻

5. Key UX Principles (Do Not Violate)
	1.	Charts always remain visible
	2.	Research never hides analysis
	3.	Interaction > typing
	4.	Insight before chat
	5.	Explainability by default

⸻

6. Demo Expectations

The clickable demo should allow:
	•	Clicking charts to trigger AI insight
	•	Seeing charts and research update together
	•	Exploring without typing
	•	Understanding “why” at a glance

The demo does not need real data.
Synthetic data is acceptable if behaviour is correct.

⸻

7. Success Criteria

The demo succeeds if a user can:
	•	Identify an emerging issue in <10 seconds
	•	Understand root cause without reading raw data
	•	Trust the insight provided
	•	Explain the story to an executive

⸻

End of Specification