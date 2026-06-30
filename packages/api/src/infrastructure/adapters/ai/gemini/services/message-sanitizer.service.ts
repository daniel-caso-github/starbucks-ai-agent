import { Injectable, Logger } from '@nestjs/common';

/**
 * Service for sanitizing user messages before sending to Gemini AI.
 *
 * Provides protection against:
 * - Prompt injection attacks
 * - Control characters
 * - HTML/Script injection
 * - Excessively long messages
 */
@Injectable()
export class MessageSanitizerService {
  private readonly logger = new Logger(MessageSanitizerService.name);

  // Maximum allowed message length
  private readonly maxMessageLength = 1000;

  // Patterns that may indicate prompt injection attempts
  private readonly injectionPatterns: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
    /forget\s+(your|all|the)\s+(\w+\s+)?(instructions|rules|prompts)/i,
    /you\s+are\s+now\s+(a|an|the)/i,
    /new\s+(instructions|rules|prompt):/i,
    /system\s*prompt:/i,
    /\[system\]/i,
    /\[assistant\]/i,
    /###\s*(system|instruction|prompt)/i,
    /---\s*(system|instruction|prompt)/i,
    /===\s*(system|instruction|prompt)/i,
    /act\s+as\s+(if\s+)?(you\s+are|a|an)/i,
    /pretend\s+(to\s+be|you\s+are)/i,
    /override\s+(your|the|all)\s+(instructions|rules)/i,
    /disregard\s+(your|the|all|previous)\s+(\w+\s+)?(instructions|rules)/i,
  ];

  /**
   * Sanitizes a user message applying all security measures.
   * Returns the cleaned message safe for AI processing.
   */
  sanitize(message: string): string {
    if (!message || typeof message !== 'string') {
      return '';
    }

    let sanitized = message;

    // Step 1: Remove control characters (keep newlines and tabs)
    sanitized = this.removeControlCharacters(sanitized);

    // Step 2: Normalize whitespace
    sanitized = this.normalizeWhitespace(sanitized);

    // Step 3: Escape HTML entities
    sanitized = this.escapeHtml(sanitized);

    // Step 4: Truncate if too long
    sanitized = this.truncateIfNeeded(sanitized, this.maxMessageLength);

    // Step 5: Check for prompt injection (log warning but don't block)
    if (this.detectPromptInjection(message)) {
      this.logger.warn(
        `Potential prompt injection detected in message: "${message.substring(0, 50)}..."`,
      );
    }

    return sanitized.trim();
  }

  /**
   * Detects potential prompt injection patterns in a message.
   * Returns true if suspicious patterns are found.
   */
  detectPromptInjection(message: string): boolean {
    if (!message) return false;

    const lowerMessage = message.toLowerCase();

    for (const pattern of this.injectionPatterns) {
      if (pattern.test(lowerMessage)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Removes control characters from the message.
   * Preserves newlines (\n), carriage returns (\r), and tabs (\t).
   */
  removeControlCharacters(message: string): string {
    // Remove all control characters except \n, \r, \t
    // Control characters are in ranges: 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F
    return message.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Escapes HTML special characters to prevent XSS.
   */
  escapeHtml(message: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };

    return message.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
  }

  /**
   * Truncates message if it exceeds the maximum length.
   * Tries to truncate at word boundary.
   */
  truncateIfNeeded(message: string, maxLength: number): string {
    if (message.length <= maxLength) {
      return message;
    }

    // Try to truncate at a word boundary
    const truncated = message.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Normalizes whitespace in the message.
   * Collapses multiple spaces and trims.
   */
  normalizeWhitespace(message: string): string {
    // Replace multiple spaces with single space
    // Replace multiple newlines with double newline
    return message.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Sanitizes AI response by removing code-like patterns.
   * This prevents the AI from outputting function calls as text.
   */
  sanitizeResponse(response: string): string {
    if (!response || typeof response !== 'string') {
      return '';
    }

    let sanitized = response;

    // Remove patterns that look like code or function calls
    const codePatterns: RegExp[] = [
      /print\s*\([^)]*\)/gi, // print(...)
      /default_api\.\w+\s*\([^)]*\)/gi, // default_api.function(...)
      /\w+_api\.\w+\s*\([^)]*\)/gi, // any_api.function(...)
      /console\.(log|error|warn)\s*\([^)]*\)/gi, // console.log(...)
      /^```[\s\S]*?```$/gm, // code blocks
      /`[^`]+`/g, // inline code (if it looks like a function call)
    ];

    for (const pattern of codePatterns) {
      if (pattern.test(sanitized)) {
        this.logger.warn(`Removing code-like pattern from response: ${pattern}`);
        sanitized = sanitized.replace(pattern, '').trim();
      }
    }

    // If the response is now empty or too short, return a fallback
    if (sanitized.length < 3) {
      return '';
    }

    return sanitized.trim();
  }
}
