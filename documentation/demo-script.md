# JourneyWorks Demo Script

> **Duration:** ~5 minutes  
> **Pre-requisites:** App running at http://localhost:4200 with seeded data (`./scripts/seed.sh --with-embeddings`)  
> **Tip:** Use "All Time" date range so all event markers are visible.

---

## Part 1 — Introducing the Main Screen

> _Open http://localhost:4200 in the browser. The Analysis Dashboard loads._

**Narrator:**

"This is **JourneyWorks** — an AI-powered Customer Communications Intelligence Platform. Everything you see on-screen is designed to turn thousands of raw customer interactions into actionable insight — without writing a single query."

### The Filter Bar

"Across the top is our **global filter bar**. Every control here — date range, channel, product, and the Events toggle — applies instantly to every chart and to the AI panel on the right. We can filter down to a single product, a single channel, or a specific time window, and the entire workspace adapts."

- Point out the **Date Range** dropdown (Last 7 / 30 / 90 days, YTD, All Time)
- Point out the **Channel** filter (Email, Phone, Chat, Social Media, Letter)
- Point out the **Product** filter (Current Accounts, Savings, Mortgages, Cards, etc.)
- Toggle the **Events** switch on (event marker lines appear on the timeline)
- Mention the **Surveys Only** toggle — "dims non-survey data so we can isolate NPS survey responses"

---

### Chart 1 — Sentiment-Weighted Event Timeline

"The main chart is the **Sentiment-Weighted Event Timeline**. Each bubble is a day of customer communications."

| Visual Element                                | What It Means                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------- |
| **X position**                                | Date                                                                               |
| **Y position**                                | Aggregate sentiment score for that day                                             |
| **Bubble size**                               | Communication volume — bigger means more contacts                                  |
| **Colour**                                    | RAG-coded: **red** = negative sentiment, **amber** = neutral, **green** = positive |
| **Gold ring**                                 | That day has NPS survey responses attached                                         |
| **Badges** (📈 PEAK / 📉 TROUGH / ⚠️ OUTLIER) | Statistical outliers in NPS scores                                                 |

"Behind the bubbles you can see a **gradient band** — that's **social media sentiment** over time. It acts as an early-warning layer: social sentiment often moves before complaints do."

"The **vertical lines** are **event markers** — red for outages, green dashed for product launches, blue dashed for announcements and issues. These are real bank events that we overlay onto the customer data."

"Below the main chart is a **mini navigator** — a volume area chart. Drag the handles to zoom and pan through time. Or use the date-range dropdown to jump to a preset window."

---

### Chart 2 — Volume vs Sentiment Quadrant

"Bottom-left is the **Quadrant Chart**. It plots issues by volume and sentiment into four zones:"

| Quadrant                    | Meaning                          | Action                     |
| --------------------------- | -------------------------------- | -------------------------- |
| 🔴 **Critical** (top-left)  | High volume + negative sentiment | Immediate attention needed |
| 🟠 **Watch** (bottom-left)  | Low volume + negative sentiment  | Monitor for escalation     |
| 🟢 **Strength** (top-right) | High volume + positive sentiment | Things going well          |
| ⚪ **Noise** (bottom-right) | Low volume + positive sentiment  | Low priority               |

"Click any dot or any quadrant background and the AI panel runs a deep-dive analysis."

---

### Chart 3 — Sentiment Journey Waterfall

"Bottom-right is the **Journey Waterfall**. It breaks the customer complaint journey into stages — Initial Contact, Triage, Investigation, Resolution, and Post-Resolution — and shows the NPS gain or loss at each step."

"Green bars are sentiment improvements; red bars are drops. The blue **Net Outcome** bar shows the overall journey impact. Click any stage to ask the AI what's driving the sentiment change at that point."

---

### The AI Research Panel

"On the right is the **AI Research Panel**. Before we interact with anything, it shows hint cards explaining what you can do — click an event, brush a time range, click a bubble, or click a journey stage."

"The moment we interact with any chart, this panel comes alive with a full AI analysis. Let me show you."

---

## Part 2 — Running an Insight Analysis on an Event Marker

> _Make sure the Events toggle is ON. Set the date range to "All Time" so the outage markers are visible._

**Narrator:**

"Let's say we've noticed some customer complaints spiked and we want to understand why. I'm going to click on this **Payment Gateway Downtime** outage marker" — _click the red vertical line for the "Payment Gateway Downtime" event around December 2025 (the critical-severity one)_.

> _The event marker bolds. Surrounding bubbles within a ±2-day window highlight; everything else dims. The AI Research Panel starts loading._

"Watch what happens. The platform automatically selects a window around the event and sends the context to our AI analysis engine."

### What the AI Panel Shows

Walk through each section as it appears:

1. **Summary** — "The AI provides a 2–3 sentence narrative of what happened: root cause, affected customers, scale of impact."

2. **Confidence Score** — "Notice the confidence chip — High, Medium, or Low. This tells us how much evidence backs this finding."

3. **Key Drivers** — "Below the summary, the AI lists the main contributing factors — e.g. 'Payment processing delays affected card transactions', 'Spike in phone complaints from Advance Account holders'."

4. **Supporting Charts** — "The panel can render inline mini-charts — bar charts, pie charts, or trend lines — built from the actual data, right inside the insight."

5. **Evidence** — _Expand the Evidence section._ "Here we see the actual source communications — complaint excerpts, social media posts, call summaries. Each one has a sentiment badge and a timestamp. Click any evidence item and it highlights the corresponding data point on the chart."

6. **Agent Reasoning Steps** — _Expand the Reasoning section._ "This is the full audit trail. Each step shows what the AI agent did — which tools it called, what it searched, what it observed. You can even expand a step to see the raw LLM prompt. Full transparency — no black box."

7. **Suggested Actions** — "At the bottom, the AI recommends concrete next steps — these appear as action chips."

---

## Part 3 — Asking a Follow-Up Question

**Narrator:**

"Now that we have the initial analysis, we can dig deeper. Notice the **suggested question chips** at the bottom of the panel — these are context-aware, generated based on the event we just analysed."

> _Click the suggested question chip: **"Which customer segments were most affected?"**_  
> _(Or type a custom question in the chat input, e.g. "Which customer tier saw the highest complaint volume during this outage?")_

"I'll click this one — 'Which customer segments were most affected?'"

> _The chat input populates and sends. A live reasoning indicator appears — animated dots and a real-time display of the agent's thinking steps._

"Watch the **live reasoning** — you can see each step the agent takes in real-time: searching complaints, aggregating by customer tier, computing sentiment breakdowns."

> _After a few seconds, the response streams in._

"The AI comes back with a detailed breakdown — for example, it might tell us that Platinum-tier customers were disproportionately impacted, or that phone-channel complaints spiked more than digital. And again, we have full evidence and reasoning steps for every answer."

"This is a real conversation — I can ask another follow-up, drill into a specific customer segment, or pivot to a completely different question. The context carries forward."

---

## Wrap-Up

**Narrator:**

"So to recap what we've just seen:"

1. **A unified analytical workspace** — three coordinated charts that let an analyst instantly spot patterns, outliers, and trends across thousands of communications.

2. **AI-powered insight on demand** — click any chart element and get a full root-cause analysis with evidence, confidence scoring, and an audit trail of the AI's reasoning.

3. **Conversational follow-up** — ask natural-language questions with full context, and get streaming answers backed by real data.

4. **Full transparency** — every insight shows its evidence, every AI step can be inspected, and confidence levels are clearly communicated.

"All of this runs on the customer's own data, in their own environment. The AI never sees data it shouldn't, and every answer is grounded in real communications — not hallucinated."

---

### Bonus: Quick Interactions to Highlight (if time permits)

| Action                                                               | What It Shows                                       |
| -------------------------------------------------------------------- | --------------------------------------------------- |
| Drag-brush a time range on the main chart → click the "Analyse" chip | Period-based AI analysis                            |
| Click a red bubble (negative sentiment day)                          | Day-level deep dive with NPS breakdown              |
| Click the **Critical** quadrant background                           | All critical issues analysed together               |
| Click the **Resolution** stage in the waterfall                      | "Why does sentiment drop at Resolution?"            |
| Toggle **Surveys Only**                                              | Isolates real NPS survey data from estimated scores |
| Open **Full Research Page** (link at bottom of panel)                | Full-page chat with shared conversation history     |
