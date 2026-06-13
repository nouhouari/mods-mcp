/**
 * C-validate — Frozen Public Interface Contract
 * Version: P1 | Frozen: 2026-06-13
 *
 * Pure-computation leaf: no I/O, no DB access, no side effects.
 * WCAG 2.2 Level AA criteria: 1.4.3 (contrast), 2.5.8 (target size),
 *   2.4.11 (focus-visible, warning), 4.1.2 (ARIA states, error).
 *
 * Accepted color formats: #RGB, #RRGGBB, rgb(R,G,B) integer 0-255.
 * Color extraction from snippets: inline style attributes ONLY.
 *
 * Reference contrast vectors (ratio ± 0.02):
 *   #000000 vs #FFFFFF → 21.0   passes all
 *   #767676 vs #FFFFFF → 4.54   passes "normal"
 *   #777777 vs #FFFFFF → 4.48   fails "normal", passes "large"/"ui"
 *   #0000FF vs #FFFFFF → 8.59   passes all
 */

/** Accepted color string: #RGB, #RRGGBB, or rgb(R,G,B). */
export type ColorInput = string;

/** WCAG 1.4.3 context: "normal"→4.5:1, "large"/"ui"→3:1. */
export type ColorContext = "normal" | "large" | "ui";

/** Result of a single color-pair contrast check (REQ-011, WCAG 1.4.3). */
export interface ContrastResult {
  passes: boolean;
  /** Ratio rounded to 2 decimal places. Range 1.0–21.0. */
  ratio: number;
  /** 4.5 for "normal", 3.0 for "large"/"ui". */
  requiredRatio: number;
  /** Always "1.4.3" for color-pair checks. */
  criterion: string;
  fg: ColorInput;
  bg: ColorInput;
}

/** "error" = definitively fails a Level AA criterion. "warning" = may fail (static analysis limit). */
export type ViolationSeverity = "error" | "warning";

/**
 * A single WCAG conformance finding.
 * WCAG 1.4.3 → error | 2.5.8 → error | 2.4.11 → warning | 4.1.2 → error
 */
export interface Violation {
  /** WCAG SC identifier, e.g. "1.4.3", "2.5.8", "2.4.11", "4.1.2". */
  criterion: string;
  severity: ViolationSeverity;
  description: string;
  remediation: string;
  /** Offending element tag/id, e.g. "button#submit". Omitted if not attributable. */
  element?: string;
}

/** Aggregated result of a snippet or token-pair validation (REQ-014, REQ-015). */
export interface ConformanceReport {
  /** true iff violations is empty. Warnings do not affect this flag. */
  passes: boolean;
  violations: Violation[];
  warnings: Violation[];
}

/** Input for validateSnippet (REQ-015). */
export interface SnippetInput {
  content: string;
  /** Defaults to "html". "jsx" uses @babel/parser. */
  contentType?: "html" | "jsx";
}

/** Input metadata for validateTokenUsage (REQ-014). */
export interface TokenUsageInput {
  projectId: string;
  fgKey: string;
  bgKey: string;
  context: ColorContext;
}

/** Machine-readable error codes thrown by C-validate. Match on code, not message. */
export const C_VALIDATE_ERRORS = {
  /** Input is not #RGB, #RRGGBB, or rgb(R,G,B). */
  INVALID_COLOR_FORMAT: "INVALID_COLOR_FORMAT",
  /** Token resolved but its value is not a color category. */
  TOKEN_NOT_A_COLOR: "TOKEN_NOT_A_COLOR",
} as const;

export type CValidateErrorCode =
  (typeof C_VALIDATE_ERRORS)[keyof typeof C_VALIDATE_ERRORS];

/**
 * Compute WCAG 1.4.3 contrast ratio (REQ-011).
 * Uses sRGB relative-luminance formula (IEC 61966-2-1).
 * @throws INVALID_COLOR_FORMAT if fg or bg cannot be parsed.
 */
export declare function validateColorPair(
  fg: ColorInput,
  bg: ColorInput,
  context: ColorContext
): ContrastResult;

/**
 * Run all P1 WCAG AA checks against an HTML/JSX snippet (REQ-015).
 * Parse errors surface as Violation {criterion:"parse", severity:"error"}.
 */
export declare function validateSnippet(input: SnippetInput): ConformanceReport;

/**
 * Validate a resolved design-token color pair (REQ-014).
 * @param resolvedFg Resolved hex/rgb value for fgKey.
 * @param resolvedBg Resolved hex/rgb value for bgKey.
 * @throws INVALID_COLOR_FORMAT | TOKEN_NOT_A_COLOR.
 */
export declare function validateTokenUsage(
  input: TokenUsageInput,
  resolvedFg: ColorInput,
  resolvedBg: ColorInput
): ConformanceReport;
