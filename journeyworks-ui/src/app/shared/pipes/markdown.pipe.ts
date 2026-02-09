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

    // Process the text line by line for better list handling
    const lines = value.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let inSubList = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      // Convert headers (h1-h4)
      // Strip bold markers (**) from heading content since headings are already styled
      if (line.match(/^####\s/)) {
        if (inList) {
          result.push(inSubList ? '</ul>' : '');
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          inSubList = false;
          listType = null;
        }
        const content = line.replace(/^####\s(.*)$/, '$1');
        result.push(`<h4>${this.stripBold(content)}</h4>`);
        continue;
      }
      if (line.match(/^###\s/)) {
        if (inList) {
          result.push(inSubList ? '</ul>' : '');
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          inSubList = false;
          listType = null;
        }
        const content = line.replace(/^###\s(.*)$/, '$1');
        result.push(`<h3>${this.stripBold(content)}</h3>`);
        continue;
      }
      if (line.match(/^##\s/)) {
        if (inList) {
          result.push(inSubList ? '</ul>' : '');
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          inSubList = false;
          listType = null;
        }
        const content = line.replace(/^##\s(.*)$/, '$1');
        result.push(`<h2>${this.stripBold(content)}</h2>`);
        continue;
      }
      if (line.match(/^#\s/)) {
        if (inList) {
          result.push(inSubList ? '</ul>' : '');
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          inSubList = false;
          listType = null;
        }
        const content = line.replace(/^#\s(.*)$/, '$1');
        result.push(`<h1>${this.stripBold(content)}</h1>`);
        continue;
      }

      // Convert bold-only lines (e.g. "**Section Title**") to headings
      // LLMs commonly output these as section separators
      const boldHeadingMatch = line.match(/^\*\*(.+)\*\*$/);
      if (boldHeadingMatch) {
        if (inSubList) {
          result.push('</ul>');
          inSubList = false;
        }
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          listType = null;
        }
        result.push(`<h4>${boldHeadingMatch[1]}</h4>`);
        continue;
      }

      // Check for numbered list item (e.g., "1. Item")
      const numberedMatch = line.match(/^(\d+)\.\s+(.*)$/);
      if (numberedMatch) {
        if (inSubList) {
          result.push('</ul>');
          inSubList = false;
        }
        if (!inList || listType !== 'ol') {
          if (inList) {
            result.push(listType === 'ul' ? '</ul>' : '</ol>');
          }
          result.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${this.processInline(numberedMatch[2])}</li>`);
        continue;
      }

      // Check for bullet point with indentation (sub-item)
      const subBulletMatch = line.match(/^[\s\t]+[•\-\*]\s+(.*)$/);
      if (subBulletMatch) {
        if (!inSubList) {
          result.push('<ul class="sub-list">');
          inSubList = true;
        }
        result.push(`<li>${this.processInline(subBulletMatch[1])}</li>`);
        continue;
      }

      // Check for bullet point (top-level)
      const bulletMatch = line.match(/^[•\-\*]\s+(.*)$/);
      if (bulletMatch) {
        if (inSubList) {
          result.push('</ul>');
          inSubList = false;
        }
        if (!inList || listType !== 'ul') {
          if (inList) {
            result.push(listType === 'ul' ? '</ul>' : '</ol>');
          }
          result.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${this.processInline(bulletMatch[1])}</li>`);
        continue;
      }

      // Empty line - close lists
      if (line.trim() === '') {
        if (inSubList) {
          result.push('</ul>');
          inSubList = false;
        }
        if (inList) {
          result.push(listType === 'ul' ? '</ul>' : '</ol>');
          inList = false;
          listType = null;
        }
        result.push('<br>');
        continue;
      }

      // Regular paragraph text
      if (inSubList) {
        result.push('</ul>');
        inSubList = false;
      }
      if (inList) {
        result.push(listType === 'ul' ? '</ul>' : '</ol>');
        inList = false;
        listType = null;
      }
      result.push(`<p>${this.processInline(line)}</p>`);
    }

    // Close any open lists
    if (inSubList) {
      result.push('</ul>');
    }
    if (inList) {
      result.push(listType === 'ul' ? '</ul>' : '</ol>');
    }

    let html = result.join('\n');

    // Clean up multiple consecutive <br> tags
    html = html.replace(/(<br>\s*){2,}/g, '<br>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    // Clean up <br> right before block elements
    html = html.replace(/<br>\s*(<(?:h[1-4]|ul|ol|p)>)/g, '$1');

    // Clean up <br> right after block elements
    html = html.replace(/(<\/(?:h[1-4]|ul|ol|p)>)\s*<br>/g, '$1');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Strip bold markers from heading content.
   * Headings are already visually styled, so bold markers are redundant.
   */
  private stripBold(text: string): string {
    return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1');
  }

  /**
   * Process inline markdown (bold, italic, code, links)
   */
  private processInline(text: string): string {
    let result = text;

    // Convert bold (**text** or __text__) - use .+? to require at least one char
    // Handle multiple bold sections in the same line
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Convert italic (*text* or _text_) - careful not to match bold
    // Only match single asterisks not preceded/followed by another asterisk
    result = result.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    result = result.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

    // Convert inline code (`code`)
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Convert links ([text](url))
    result = result.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>',
    );

    return result;
  }
}
