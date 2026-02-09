import { Component, input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  LiveReasoningStep,
  ReasoningStep,
} from '../../../../core/services/research.service';
import { InsightReasoningStep } from '../../../../core/models/analysis.model';

/**
 * Compact reasoning summary bubble for chat messages.
 *
 * Two modes:
 *  - **Streaming**: shows a pulsing "Thinking..." indicator with live step count
 *  - **Complete**: shows a collapsible "Reasoned through N steps" summary
 *
 * Designed for tight spaces (35% sidebar chat area).
 */
@Component({
  selector: 'app-reasoning-summary',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reasoning-summary.component.html',
  styleUrl: './reasoning-summary.component.scss',
})
export class ReasoningSummaryComponent {
  /** Static reasoning steps (from completed HTTP response) */
  steps = input<InsightReasoningStep[] | ReasoningStep[]>([]);

  /** Live reasoning steps (from WebSocket streaming) */
  liveSteps = input<LiveReasoningStep[]>([]);

  /** Whether the agent is currently streaming */
  streaming = input(false);

  /** Current streaming status text */
  streamStatus = input('');

  /** Whether the summary is expanded to show individual steps */
  isExpanded = signal(false);

  /** Resolved step list — prefers live steps while streaming, falls back to static */
  readonly resolvedSteps = computed(() => {
    const live = this.liveSteps();
    if (live.length > 0) return live;
    return this.steps();
  });

  /** Total step count */
  readonly stepCount = computed(() => this.resolvedSteps().length);

  /** Whether there's anything to show */
  readonly hasSteps = computed(() => this.stepCount() > 0 || this.streaming());

  /** Summary label text */
  readonly summaryLabel = computed(() => {
    if (this.streaming()) {
      const count = this.stepCount();
      const status = this.streamStatus();
      if (status) return status;
      return count > 0 ? `Thinking... Step ${count}` : 'Thinking...';
    }
    const count = this.stepCount();
    return `Reasoned through ${count} step${count !== 1 ? 's' : ''}`;
  });

  /** Get a one-line summary of a step */
  getStepSummary(
    step: InsightReasoningStep | ReasoningStep | LiveReasoningStep,
  ): string {
    // Use action if available and not "Final Answer"
    if (step.action && step.action !== 'Final Answer') {
      return step.action;
    }
    // Fall back to first ~80 chars of thought
    const thought = step.thought || '';
    return thought.length > 80 ? thought.substring(0, 77) + '...' : thought;
  }

  /** Get icon for a step based on its status */
  getStepIcon(
    step: InsightReasoningStep | ReasoningStep | LiveReasoningStep,
  ): string {
    if ('status' in step) {
      switch (step.status) {
        case 'thinking':
          return 'psychology';
        case 'tool-running':
          return 'build';
        case 'complete':
          return step.toolSuccess === false ? 'error' : 'check_circle';
        case 'error':
          return 'error';
      }
    }
    return 'check_circle';
  }

  /** Get CSS class for step status */
  getStepClass(
    step: InsightReasoningStep | ReasoningStep | LiveReasoningStep,
  ): string {
    if ('status' in step) {
      return `step-${step.status}`;
    }
    return 'step-complete';
  }

  /** Whether a step is a live step (has status field) */
  isLiveStep(
    step: InsightReasoningStep | ReasoningStep | LiveReasoningStep,
  ): step is LiveReasoningStep {
    return 'status' in step;
  }

  toggleExpanded(): void {
    if (!this.streaming() && this.stepCount() > 0) {
      this.isExpanded.update((v) => !v);
    }
  }
}
