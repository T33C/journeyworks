import {
  Component,
  inject,
  signal,
  effect,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { AnalysisStateService } from '../../../core/services/analysis-state.service';
import { AnalysisDataService } from '../../../core/services/analysis-data.service';
import { ResearchService } from '../../../core/services/research.service';
import {
  ResearchInsight,
  EvidenceItem,
  AnalysisContext,
} from '../../../core/models/analysis.model';
import { InsightChartCardComponent } from './insight-chart-card.component';

interface ChatMessage {
  role: 'user' | 'ai';
  message: string;
  timestamp?: Date;
}

@Component({
  selector: 'app-research-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MarkdownPipe,
    InsightChartCardComponent,
  ],
  templateUrl: './research-panel.component.html',
  styleUrl: './research-panel.component.scss',
})
export class ResearchPanelComponent implements AfterViewChecked {
  private stateService = inject(AnalysisStateService);
  private dataService = inject(AnalysisDataService);
  private researchService = inject(ResearchService);
  private router = inject(Router);

  @ViewChild('chatHistoryContainer') chatHistoryContainer!: ElementRef;
  @ViewChild('chatSectionEl') chatSectionEl!: ElementRef;

  context = this.stateService.context;
  isLoading = signal(false);
  isTyping = signal(false);
  insight = signal<ResearchInsight | null>(null);
  chatInput = '';
  isChatExpanded = signal(false);
  private shouldScrollToBottom = false;

  // Chat history - computed from the shared ResearchService for persistence
  // This allows chat to persist when navigating between dashboard and research page
  readonly chatHistory = computed(() => {
    const sharedMessages = this.researchService.messages();
    return sharedMessages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'ai',
      message: msg.content,
      timestamp: msg.timestamp ? new Date(msg.timestamp) : undefined,
    })) as ChatMessage[];
  });

  // Shared conversation state from ResearchService
  readonly hasSharedConversation = this.researchService.hasConversation;
  readonly sharedMessageCount = this.researchService.messageCount;

  // Resize state
  chatHeight = signal<number | null>(null); // null means use CSS default
  isResizing = signal(false);
  private isDragging = false;
  private startY = 0;
  private startHeight = 0;

  // Computed suggested questions - prefer LLM-generated, fallback to context-based
  suggestedQuestions = computed(() => {
    // First check if the insight has LLM-generated questions
    const currentInsight = this.insight();
    if (
      currentInsight?.suggestedQuestions &&
      currentInsight.suggestedQuestions.length > 0
    ) {
      return currentInsight.suggestedQuestions.slice(0, 3);
    }

    // Fallback to context-based suggestions
    const ctx = this.context();

    // Outage/incident context
    if (
      ctx?.event?.type === 'outage' ||
      ctx?.signal?.toLowerCase().includes('outage')
    ) {
      return [
        'What caused this outage spike?',
        'Which customer segments were most affected?',
        'Compare to previous incidents',
      ];
    }

    // Fee/announcement context
    if (
      ctx?.event?.type === 'announcement' ||
      ctx?.signal?.toLowerCase().includes('fee')
    ) {
      return [
        'Why is resolution satisfaction low?',
        'How do long-term customers differ?',
        'What compensation was offered?',
      ];
    }

    // Quadrant selection
    if (ctx?.quadrant === 'critical') {
      return [
        'What are the top critical issues?',
        'Why is triage taking so long?',
        'Show resolution bottlenecks',
      ];
    }
    if (ctx?.quadrant === 'strength') {
      return [
        'What makes these journeys successful?',
        'How can we replicate this?',
        'Show best practices',
      ];
    }

    // Time window selection
    if (ctx?.timeWindow) {
      return [
        'What drove complaints in this period?',
        'Compare to the previous week',
        'Show unusual patterns',
      ];
    }

    // Journey stage
    if (ctx?.journeyStage) {
      return [
        'What slows down this stage?',
        'Show common blockers',
        'Recommend process improvements',
      ];
    }

    // Bubble selection - contextual questions based on NPS and themes
    if (ctx?.selectedBubble) {
      const bubble = ctx.selectedBubble;
      const questions = [];

      if (bubble.detractorPct > 40) {
        questions.push('Why is the detractor rate so high?');
      }
      if (bubble.promoterPct > 40) {
        questions.push("What's driving the high promoter rate?");
      }
      questions.push(`What caused ${bubble.themes[0] || 'these issues'}?`);
      questions.push('Compare to the previous period');
      questions.push('Show customer verbatims');

      return questions.slice(0, 3);
    }

    // Default suggestions (no context)
    return [
      "What's driving complaints today?",
      'Show emerging issues',
      'Compare to last month',
    ];
  });

  constructor() {
    // React to context changes - load insight when user selects something, reset when cleared
    effect(() => {
      const ctx = this.context();
      if (
        ctx &&
        (ctx.event ||
          ctx.timeWindow ||
          ctx.quadrant ||
          ctx.journeyStage ||
          ctx.selectedBubble)
      ) {
        this.loadInsight(ctx);
      } else {
        // Context was cleared - reset to initial state
        this.insight.set(null);
        // Note: Don't clear shared conversation state here - let user explicitly clear it
        this.isLoading.set(false);
        this.isTyping.set(false);
      }
    });
    // No auto-load on init - show empty state until user interacts
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  toggleChatExpanded() {
    this.isChatExpanded.update((v) => !v);
    // Reset custom height and resizing state when toggling
    this.chatHeight.set(null);
    this.isResizing.set(false);
  }

  // Resize handlers
  onResizeStart(event: MouseEvent) {
    event.preventDefault();
    this.isDragging = true;
    this.startY = event.clientY;

    // Get current height from element
    const el = this.chatSectionEl?.nativeElement;
    if (el) {
      this.startHeight = el.offsetHeight;
    }

    // Mark as resizing to override CSS expand behavior
    this.isResizing.set(true);
  }

  @HostListener('document:mousemove', ['$event'])
  onResizeMove(event: MouseEvent) {
    if (!this.isDragging) return;

    // Calculate new height (dragging up increases height)
    const deltaY = this.startY - event.clientY;
    const newHeight = Math.max(140, Math.min(600, this.startHeight + deltaY));
    this.chatHeight.set(newHeight);
  }

  @HostListener('document:mouseup')
  onResizeEnd() {
    this.isDragging = false;
  }

  private scrollToBottom() {
    if (this.chatHistoryContainer?.nativeElement) {
      const container = this.chatHistoryContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  private loadInsight(context: AnalysisContext) {
    this.isLoading.set(true);
    this.dataService.getInsight(context).subscribe((data) => {
      this.insight.set(data);
      this.isLoading.set(false);
    });
  }

  onSuggestedQuestionClick(question: string) {
    this.chatInput = question;
    this.onChatSubmit();
  }

  onChatSubmit() {
    if (!this.chatInput.trim()) return;

    const userMessage = this.chatInput;
    const ctx = this.context();

    // Add to shared ResearchService state (chatHistory is derived from this)
    this.researchService.addUserMessage(userMessage);
    if (ctx) {
      // Convert AnalysisContext to ResearchContext format
      this.researchService.setContext({
        event: ctx.event
          ? {
              id: ctx.event.id,
              type: ctx.event.type,
              label: ctx.event.label,
            }
          : undefined,
        timeWindow: ctx.timeWindow
          ? {
              start: ctx.timeWindow.start.toISOString(),
              end: ctx.timeWindow.end.toISOString(),
            }
          : undefined,
        journeyStage: ctx.journeyStage?.stage,
        quadrant: ctx.quadrant,
      });
    }

    this.chatInput = '';
    this.shouldScrollToBottom = true;

    // Auto-expand chat when user sends a message
    if (!this.isChatExpanded()) {
      this.isChatExpanded.set(true);
    }

    // Show typing indicator
    this.isTyping.set(true);

    // If we have context, use real LLM with data
    if (ctx) {
      this.dataService.askFollowUpQuestion(ctx, userMessage).subscribe({
        next: (insight) => {
          this.isTyping.set(false);
          // Format the response from the insight
          const response = this.formatInsightAsResponse(insight, userMessage);

          // Add to shared ResearchService state (chatHistory is derived from this)
          this.researchService.addAssistantMessage(response);

          this.shouldScrollToBottom = true;
          // Update suggested questions from the new response
          if (insight.suggestedQuestions?.length) {
            this.insight.update((current) =>
              current
                ? { ...current, suggestedQuestions: insight.suggestedQuestions }
                : current,
            );
            // Also update shared suggestions
            this.researchService.setSuggestions(insight.suggestedQuestions);
          }
        },
        error: (err) => {
          console.error('Follow-up question failed:', err);
          this.isTyping.set(false);
          // Fallback to generated response on error
          const response = this.generateChatResponse(userMessage);
          // Add to shared state
          this.researchService.addAssistantMessage(response);
          this.shouldScrollToBottom = true;
        },
      });
    } else {
      // No context - use fallback response
      const thinkTime = 500 + Math.random() * 500;
      setTimeout(() => {
        this.isTyping.set(false);
        const response = this.generateChatResponse(userMessage);
        // Add to shared state
        this.researchService.addAssistantMessage(response);
        this.shouldScrollToBottom = true;
      }, thinkTime);
    }
  }

  /**
   * Navigate to the full research page to continue the conversation
   */
  openFullResearchPage(): void {
    this.router.navigate(['/research']);
  }

  /**
   * Format an insight response as a chat message
   */
  private formatInsightAsResponse(
    insight: ResearchInsight,
    question: string,
  ): string {
    const parts: string[] = [];

    // Main summary
    if (insight.summary) {
      parts.push(insight.summary);
    }

    // Key drivers if relevant
    if (insight.keyDrivers?.length > 0) {
      parts.push('\n\n**Key Factors:**');
      insight.keyDrivers.forEach((driver) => {
        parts.push(`• ${driver}`);
      });
    }

    // Timeline reasoning if available
    if (insight.timelineReasoning) {
      parts.push(`\n\n**Timeline Analysis:**\n${insight.timelineReasoning}`);
    }

    // Suggested actions if the question asks for recommendations
    const q = question.toLowerCase();
    if (
      (q.includes('recommend') ||
        q.includes('action') ||
        q.includes('improve') ||
        q.includes('fix')) &&
      insight.suggestedActions?.length > 0
    ) {
      parts.push('\n\n**Recommended Actions:**');
      insight.suggestedActions.forEach((action) => {
        parts.push(`• ${action}`);
      });
    }

    return parts.join('\n');
  }

  private generateChatResponse(question: string): string {
    const q = question.toLowerCase();
    const ctx = this.context();

    // Outage-related questions
    if (q.includes('cause') && (q.includes('outage') || q.includes('spike'))) {
      return "**Root Cause Analysis:**\n\nThe January 3rd payment processing outage was triggered by a database failover that didn't complete correctly. The cascade:\n\n1. **14:42** - Primary database unresponsive\n2. **14:45** - Failover initiated but stuck at 67%\n3. **14:52** - Manual intervention required\n4. **15:18** - Services restored\n\nSocial media detected the issue within 3 minutes, while formal complaints began 97 minutes later.";
    }

    if (
      q.includes('segment') ||
      q.includes('affected') ||
      q.includes('customers')
    ) {
      return '**Customer Impact Analysis:**\n\n| Segment | Volume | Avg Sentiment |\n|---------|--------|---------------|\n| Premium | 312 | -0.82 |\n| Standard | 1,247 | -0.71 |\n| Basic | 156 | -0.89 |\n\nBasic account customers showed the strongest negative reaction due to payment failures during weekend shopping hours. Premium customers expected faster resolution and clearer communication.';
    }

    if (
      q.includes('compare') &&
      (q.includes('previous') || q.includes('incident') || q.includes('outage'))
    ) {
      return '**Incident Comparison:**\n\nComparing to the October 2024 outage:\n\n• **Duration:** 36min (Jan) vs 4hr 12min (Oct)\n• **Complaints:** 1,847 (Jan) vs 2,456 (Oct)\n• **Social mentions:** 3,200 (Jan) vs 1,890 (Oct)\n• **Resolution sentiment:** -0.12 (Jan) vs +0.08 (Oct)\n\nDespite shorter duration, social amplification was 69% higher. Recommend reviewing social response playbook.';
    }

    // Fee-related questions
    if (
      q.includes('resolution') &&
      (q.includes('low') || q.includes('satisfaction'))
    ) {
      return "**Resolution Satisfaction Analysis:**\n\nFee-related complaints show 42% lower resolution satisfaction because:\n\n1. **Policy constraints** - Agents have limited waiver authority\n2. **Explanation gap** - Customers don't understand fee structure\n3. **Repeat issues** - 34% had previous fee complaints\n\nRecommendation: Increase first-contact waiver limit from £10 to £25 for accounts in good standing.";
    }

    if (
      q.includes('long-term') ||
      q.includes('tenure') ||
      q.includes('differ')
    ) {
      return '**Customer Tenure Analysis:**\n\nLong-term customers (5+ years) show distinctly different patterns:\n\n• **60% stronger** negative sentiment than newer customers\n• **2.3x more likely** to escalate to formal complaint\n• **But 47% higher** retention even after complaint\n\nKey insight: Loyalty creates higher expectations. Consider implementing "Loyalty Recognition" flags for complaints from 5+ year customers.';
    }

    // Critical quadrant questions
    if (q.includes('critical') || q.includes('top issues')) {
      return '**Top Critical Issues (High Volume, Negative Sentiment):**\n\n1. **Payment Processing Errors** - 245 complaints, -0.72 sentiment\n2. **Overdraft Fee Disputes** - 189 complaints, -0.65 sentiment  \n3. **Card Declined at Merchant** - 156 complaints, -0.58 sentiment\n\nThese three issues account for 67% of critical quadrant volume. Payment processing shows the steepest sentiment drop at initial contact.';
    }

    if (
      q.includes('triage') ||
      q.includes('taking so long') ||
      q.includes('bottleneck')
    ) {
      return '**Triage Bottleneck Analysis:**\n\nCurrent triage stage is 2.3 days vs 1.5 day target. Contributing factors:\n\n• **Categorization complexity** - 23% require manual review\n• **Staffing gaps** - Weekend backlog creates Monday surge\n• **System handoffs** - 3 different systems for different products\n\nQuick win: Auto-categorize card-related complaints (currently 89% accuracy available).';
    }

    // Strength quadrant
    if (
      q.includes('successful') ||
      q.includes('strength') ||
      q.includes('best')
    ) {
      return '**Success Factor Analysis:**\n\nStrength quadrant journeys share key characteristics:\n\n✓ **First-contact resolution** - 78% resolved without transfer\n✓ **Proactive communication** - Status updates every 24hr\n✓ **Empowered agents** - Higher decision authority\n✓ **Digital self-service** - 45% resolved via app\n\nApplying these factors to critical issues could improve sentiment by an estimated +0.25 points.';
    }

    // Time window
    if (q.includes('drove') || q.includes('driving') || q.includes('period')) {
      return '**Period Analysis:**\n\nIn the selected time window, key drivers were:\n\n1. **Tuesday spike** - Payment batch processing delay (312 complaints)\n2. **Unusual pattern** - 40% increase in mobile app complaints\n3. **Positive outlier** - Branch service showing improvement (+0.15 sentiment)\n\nThe batch processing issue was systemic and affected multiple products simultaneously.';
    }

    if (
      q.includes('compare') &&
      (q.includes('week') || q.includes('month') || q.includes('last'))
    ) {
      return '**Comparative Analysis:**\n\n| Metric | This Period | Previous | Change |\n|--------|-------------|----------|--------|\n| Volume | 1,234 | 1,089 | +13% |\n| Avg Sentiment | -0.42 | -0.38 | -0.04 |\n| Resolution Rate | 67% | 72% | -5% |\n| Avg Time to Resolve | 3.2d | 2.8d | +0.4d |\n\nThe decline correlates with staffing reduction in week 2.';
    }

    // Recommendations
    if (
      q.includes('recommend') ||
      q.includes('action') ||
      q.includes('improve')
    ) {
      return '**Recommended Actions:**\n\n🔴 **Immediate (This Week)**\n• Review payment processing queue (312 pending)\n• Deploy additional triage staff for backlog\n\n🟡 **Short-term (30 Days)**\n• Implement social listening escalation rules\n• Increase fee waiver limits for tenured customers\n\n🟢 **Strategic (90 Days)**\n• Auto-categorization pilot for card complaints\n• Customer journey redesign for fee disputes';
    }

    // Emerging issues / today
    if (q.includes('emerging') || q.includes('today') || q.includes('new')) {
      return '**Emerging Issues Report:**\n\n📈 **Trending Up**\n• Mobile login failures (+156% vs yesterday)\n• International transfer delays (new cluster)\n\n📉 **Trending Down**  \n• Card activation issues (-23%)\n• Statement access problems (-45%)\n\n⚠️ **Watch List**\n• New mortgage rate complaints starting to appear\n• Social chatter about competitor rate matching';
    }

    // Pattern/unusual
    if (
      q.includes('pattern') ||
      q.includes('unusual') ||
      q.includes('anomaly')
    ) {
      return '**Pattern Detection Results:**\n\n🔍 **Unusual Patterns Found:**\n\n1. **Geographic cluster** - 67% of card declines from London postcodes\n2. **Time correlation** - Complaints spike 14:00-16:00 (school pickup time?)\n3. **Product overlap** - 34% of savings complainants also hold cards\n\nThe geographic cluster may indicate a regional merchant integration issue.';
    }

    // Default contextual response
    if (ctx?.signal) {
      return `Based on the current selection (${ctx.signal}), the analysis shows a clear correlation between the identified patterns and sentiment changes. The key finding is that customer experience degrades most significantly during the investigation phase.\n\nWould you like me to:\n• Drill into specific customer segments?\n• Compare with historical patterns?\n• Generate recommendations?`;
    }

    return 'I can help you explore the data further. Based on the current analysis, I recommend focusing on the relationship between social sentiment and formal complaint timing. The 1-3 hour lead time provides an opportunity for proactive intervention.\n\nTry asking about specific incidents, customer segments, or request recommendations.';
  }

  getEvidenceIcon(type: string): string {
    switch (type) {
      case 'complaint':
        return 'description';
      case 'social':
        return 'public';
      case 'call':
        return 'phone';
      case 'news':
        return 'newspaper';
      default:
        return 'article';
    }
  }

  onEvidenceClick(item: EvidenceItem) {
    // Highlight the linked chart element if available
    if (item.linkedChartId) {
      this.stateService.setHighlightedIds([item.linkedChartId]);
    }
  }

  getConfidenceClass(confidence: string): string {
    return `confidence-${confidence}`;
  }

  formatDate(timestamp: string | Date | undefined | null): string {
    if (!timestamp) {
      return 'No date';
    }
    const date =
      typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}
