/**
 * C-validate — Pure WCAG 2.2 Level AA validation module.
 * No I/O, no DB access, no side effects.
 *
 * Reference contrast vectors:
 *   #000000 vs #FFFFFF → 21.0  (passes all)
 *   #767676 vs #FFFFFF → 4.54  (passes "normal")
 *   #777777 vs #FFFFFF → 4.48  (fails "normal", passes "large"/"ui")
 *   #0000FF vs #FFFFFF → 8.59  (passes all)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ColorInput = string;
export type ColorContext = 'normal' | 'large' | 'ui';
export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  criterion: string;
  severity: ViolationSeverity;
  description: string;
  remediation: string;
  element?: string;
}

export interface ConformanceReport {
  passes: boolean;
  violations: Violation[];
  warnings: Violation[];
}

export interface ContrastResult {
  passes: boolean;
  ratio: number;
  requiredRatio: number;
  criterion: string;
  fg: ColorInput;
  bg: ColorInput;
}

export interface SnippetInput {
  content: string;
  contentType?: 'html' | 'jsx';
}

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export const C_VALIDATE_ERRORS = {
  INVALID_COLOR_FORMAT: 'INVALID_COLOR_FORMAT',
  INVALID_CONTEXT: 'INVALID_CONTEXT',
  TOKEN_NOT_A_COLOR: 'TOKEN_NOT_A_COLOR',
} as const;

export type CValidateErrorCode =
  (typeof C_VALIDATE_ERRORS)[keyof typeof C_VALIDATE_ERRORS];

export class ValidateError extends Error {
  code: CValidateErrorCode;
  constructor(code: CValidateErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ValidateError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Color format
// ---------------------------------------------------------------------------

export const COLOR_FORMAT_RE =
  /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))$/;

function parseColor(input: string): [number, number, number] {
  const trimmed = input.trim();
  if (!COLOR_FORMAT_RE.test(trimmed)) {
    throw new ValidateError(
      C_VALIDATE_ERRORS.INVALID_COLOR_FORMAT,
      'Invalid color format: "' + input + '". Expected #RGB, #RRGGBB, or rgb(R,G,B).'
    );
  }

  if (trimmed.startsWith('rgb(')) {
    const match = trimmed.match(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/);
    if (!match) {
      throw new ValidateError(C_VALIDATE_ERRORS.INVALID_COLOR_FORMAT, 'Invalid rgb(): "' + input + '"');
    }
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }

  // Hex
  let hex = trimmed.slice(1);
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// WCAG luminance & contrast
// ---------------------------------------------------------------------------

function linearize(c: number): number {
  const sRGB = c / 255;
  return sRGB <= 0.04045 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  const raw = (lighter + 0.05) / (darker + 0.05);
  return Math.round(raw * 100) / 100;
}

function requiredRatioFor(context: ColorContext): number {
  return context === 'normal' ? 4.5 : 3.0;
}

// ---------------------------------------------------------------------------
// Public API — validateColorPair
// ---------------------------------------------------------------------------

export function validateColorPair(
  fg: ColorInput,
  bg: ColorInput,
  context: ColorContext
): ContrastResult {
  const [fr, fg2, fb] = parseColor(fg);
  const [br, bg2, bb] = parseColor(bg);
  const lFg = relativeLuminance(fr, fg2, fb);
  const lBg = relativeLuminance(br, bg2, bb);
  const ratio = contrastRatio(lFg, lBg);
  const requiredRatio = requiredRatioFor(context);
  const passes = ratio >= requiredRatio;

  return { passes, ratio, requiredRatio, criterion: '1.4.3', fg, bg };
}

// ---------------------------------------------------------------------------
// Public API — validateTokenPair
// ---------------------------------------------------------------------------

export function validateTokenPair(
  fg: ColorInput,
  bg: ColorInput,
  context: ColorContext,
  resolvedFg: ColorInput,
  resolvedBg: ColorInput
): ConformanceReport & { resolvedFg: string; resolvedBg: string } {
  const result = validateColorPair(resolvedFg, resolvedBg, context);
  const violations: Violation[] = [];
  const warnings: Violation[] = [];

  if (!result.passes) {
    violations.push({
      criterion: '1.4.3',
      severity: 'error',
      description: 'Contrast ratio ' + result.ratio + ' is below the required ' + result.requiredRatio + ' for context "' + context + '".',
      remediation: 'Increase the contrast between "' + fg + '" (' + resolvedFg + ') and "' + bg + '" (' + resolvedBg + ').',
    });
  }

  return {
    passes: violations.length === 0,
    violations,
    warnings,
    resolvedFg,
    resolvedBg,
  };
}

// ---------------------------------------------------------------------------
// Public API — validateSnippet
// ---------------------------------------------------------------------------

export function validateSnippet(input: SnippetInput | string, contentType?: 'html' | 'jsx'): ConformanceReport {
  let content: string;
  let type: 'html' | 'jsx';

  if (typeof input === 'string') {
    content = input;
    type = contentType ?? 'html';
  } else {
    content = input.content;
    type = input.contentType ?? 'html';
  }

  const violations: Violation[] = [];
  const warnings: Violation[] = [];

  try {
    const styleAttrRe = /style\s*=\s*["']([^"']+)["']/gi;
    const styleBlocks: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = styleAttrRe.exec(content)) !== null) {
      styleBlocks.push(m[1]);
    }

    for (const block of styleBlocks) {
      const fgMatch = block.match(/(?:^|;)\s*color\s*:\s*([^;]+)/i);
      const bgMatch = block.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i);

      if (fgMatch && bgMatch) {
        const fgVal = fgMatch[1].trim();
        const bgVal = bgMatch[1].trim();

        if (COLOR_FORMAT_RE.test(fgVal) && COLOR_FORMAT_RE.test(bgVal)) {
          try {
            const result = validateColorPair(fgVal, bgVal, 'normal');
            if (!result.passes) {
              violations.push({
                criterion: '1.4.3',
                severity: 'error',
                description: 'Contrast ratio ' + result.ratio + ' between "' + fgVal + '" and "' + bgVal + '" is below 4.5:1 required for normal text.',
                remediation: 'Increase contrast between foreground "' + fgVal + '" and background "' + bgVal + '".',
              });
            }
          } catch {
            // Skip invalid color pairs silently
          }
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    violations.push({
      criterion: 'parse',
      severity: 'error',
      description: 'Failed to parse ' + type + ' snippet: ' + message,
      remediation: 'Ensure the snippet is valid HTML or JSX.',
    });
  }

  return {
    passes: violations.length === 0,
    violations,
    warnings,
  };
}
