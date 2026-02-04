/**
 * JourneyWorks UI - Markdown Pipe
 *
 * Transforms markdown text into HTML for rendering AI-generated responses
 * and research insights in the UI.
 */

import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) {
      return '';
    }

    let html = value;

    // Convert headers (h1-h4)
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    // Convert bold (**text** or __text__)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Convert italic (*text* or _text_) - careful not to match bold
    html = html.replace(
      /(?<!\*)\*(?!\*)([^*]+)(?<!\*)\*(?!\*)/g,
      '<em>$1</em>',
    );
    html = html.replace(/(?<!_)_(?!_)([^_]+)(?<!_)_(?!_)/g, '<em>$1</em>');

    // Convert bullet points (• or - or *)
    html = html.replace(/^[•\-\*]\s+(.*$)/gm, '<li>$1</li>');

    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

    // Convert numbered lists
    html = html.replace(/^\d+\.\s+(.*$)/gm, '<li>$1</li>');

    // Wrap numbered list items in <ol>
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      // Check if this block wasn't already wrapped
      if (!match.startsWith('<ul>') && !match.startsWith('<ol>')) {
        return `<ol>${match}</ol>`;
      }
      return match;
    });

    // Convert inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert code blocks (```code```)
    html = html.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      '<pre><code class="language-$1">$2</code></pre>',
    );

    // Convert blockquotes (> text)
    html = html.replace(/^>\s+(.*$)/gm, '<blockquote>$1</blockquote>');

    // Convert links ([text](url))
    html = html.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );

    // Convert line breaks (double newline = paragraph)
    html = html.replace(/\n\n/g, '</p><p>');

    // Convert single newlines to <br> within paragraphs
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith('<')) {
      html = `<p>${html}</p>`;
    }

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-4]>)/g, '$1');
    html = html.replace(/(<\/h[1-4]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ol>)/g, '$1');
    html = html.replace(/(<\/ol>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>)/g, '$1');
    html = html.replace(/(<\/blockquote>)<\/p>/g, '$1');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
