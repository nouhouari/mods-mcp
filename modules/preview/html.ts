import { Project } from '../registry';
import { ResolvedToken } from '../tokens';
import { ResolvedComponentSpec, ComponentProp } from '../components';
import { Pattern } from '../patterns';

export interface ShowcaseGuideline {
  id: string;
  title: string;
  body: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cssVarName(key: string): string {
  return '--token-' + key.replace(/\./g, '-');
}

function accentForComponent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('button') || n.includes('btn')) return 'var(--token-color-primary, #6366f1)';
  if (n.includes('input') || n.includes('field') || n.includes('form')) return 'var(--token-color-secondary, #8b5cf6)';
  if (n.includes('modal') || n.includes('dialog')) return 'var(--token-color-accent, #ec4899)';
  return '#64748b';
}

// Detects whether a token value is a standalone colour (hex / rgb / hsl).
// Shadow values contain colours inside them — they must NOT match.
const PURE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))$/i;
function isPureColor(v: string): boolean {
  return PURE_COLOR_RE.test(v.trim());
}

// ---------------------------------------------------------------------------
// Props table
// ---------------------------------------------------------------------------

function renderPropsTable(props: ComponentProp[]): string {
  if (props.length === 0) return '<p class="empty-note">No props defined.</p>';
  const rows = props
    .map(
      (p) =>
        `<tr>
          <td class="prop-name">${escHtml(p.name)}</td>
          <td class="prop-type"><code>${escHtml(p.type)}</code></td>
          <td class="prop-req">${p.required ? '<span class="badge-req">required</span>' : '<span class="badge-opt">optional</span>'}</td>
          <td class="prop-default">${p.default !== undefined ? escHtml(p.default) : ''}</td>
        </tr>`
    )
    .join('\n');
  return `<table class="props-table">
    <thead><tr><th>Name</th><th>Type</th><th>Required</th><th>Default</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ---------------------------------------------------------------------------
// Section: Color palette (#9 — includes orphan color values from other cats)
// ---------------------------------------------------------------------------

function renderColorSection(allTokens: ResolvedToken[]): string {
  // Primary colour tokens + any token in another category whose value IS a pure colour
  const primaryKeys = new Set(
    allTokens.filter((t) => t.category === 'color').map((t) => t.key)
  );
  const colorTokens = allTokens.filter(
    (t) => t.category === 'color' || (!primaryKeys.has(t.key) && isPureColor(t.value))
  );
  if (colorTokens.length === 0) return '';

  const cards = colorTokens
    .map(
      (t) => `<div class="swatch-card">
        <div class="swatch-rect" style="background: ${escHtml(t.value)};" aria-label="${escHtml(t.value)}"></div>
        <div class="swatch-meta">
          <span class="swatch-css" data-copy="${escHtml(cssVarName(t.key))}">${escHtml(cssVarName(t.key))}</span>
          <span class="swatch-key">${escHtml(t.key)}</span>
          <div class="swatch-value-row">
            <span class="swatch-value" data-copy="${escHtml(t.value)}">${escHtml(t.value)}</span>
            <button type="button" class="copy-btn" data-copy="${escHtml(t.value)}" aria-label="Copy ${escHtml(t.value)}" title="Copy value">⧉</button>
          </div>
          <span class="swatch-badge ${t.isSemantic ? 'badge-semantic' : 'badge-base'}">${escHtml(t.source)}</span>
        </div>
      </div>`
    )
    .join('\n');
  return `<div class="subsection" id="sub-colors">
    <h3>Color Palette</h3>
    <div class="swatch-grid">${cards}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Spacing (#4 — fixed scale so tiny values are visible)
// ---------------------------------------------------------------------------

function tokenToPx(value: string): number {
  const raw = parseFloat(value);
  if (isNaN(raw)) return 0;
  return value.trim().endsWith('rem') ? raw * 16 : raw;
}

function renderSpacingSection(spacingTokens: ResolvedToken[]): string {
  if (spacingTokens.length === 0) return '';

  // Sort ascending by resolved px so the scale reads small → large.
  const sorted = [...spacingTokens].sort((a, b) => tokenToPx(a.value) - tokenToPx(b.value));
  // Proportional scale with a visible FLOOR: every bar is at least FLOOR px wide
  // so it always reads as "filled", even when a large outlier token would
  // otherwise crush the rest below 1px. Largest value fills the full TRACK.
  const maxPx = Math.max(1, ...sorted.map((t) => tokenToPx(t.value)));
  const FLOOR = 10;
  const TRACK = 180;

  const rows = sorted
    .map((t) => {
      const px = tokenToPx(t.value);
      const ratio = px <= 0 ? 0 : px / maxPx;
      const barWidth = Math.round(FLOOR + ratio * (TRACK - FLOOR));
      const bar = `<div class="spacing-bar" style="width:${barWidth}px;" title="${escHtml(t.value)}"></div>`;
      return `<tr>
        <td data-copy="${escHtml(cssVarName(t.key))}">${escHtml(t.key)}</td>
        <td><code data-copy="${escHtml(t.value)}">${escHtml(t.value)}</code></td>
        <td>${bar}</td>
      </tr>`;
    })
    .join('\n');
  return `<div class="subsection" id="sub-spacing">
    <h3>Spacing</h3>
    <div class="table-wrap"><table class="token-table">
      <thead><tr><th>Key</th><th>Value</th><th>Visual</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Breakpoints (#14 — dedicated renderer, not mixed with spacing)
// ---------------------------------------------------------------------------

function renderBreakpointSection(breakpointTokens: ResolvedToken[]): string {
  if (breakpointTokens.length === 0) return '';

  const items = breakpointTokens
    .map((t) => {
      const raw = parseFloat(t.value);
      const isRem = t.value.trim().endsWith('rem');
      const px = isNaN(raw) ? 0 : isRem ? raw * 16 : raw;
      // Scale relative to 1920px max; cap bar at 280px
      const barWidth = px === 0 ? 4 : Math.max(8, Math.min(Math.round((px / 1920) * 280), 280));
      return `<div class="bp-row">
        <span class="bp-key" data-copy="${escHtml(cssVarName(t.key))}">${escHtml(t.key)}</span>
        <div class="bp-track">
          <div class="bp-bar" style="width:${barWidth}px;"></div>
        </div>
        <code class="bp-value" data-copy="${escHtml(t.value)}">${escHtml(t.value)}</code>
      </div>`;
    })
    .join('\n');
  return `<div class="subsection" id="sub-breakpoints">
    <h3>Breakpoints</h3>
    <div class="bp-list">${items}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Typography (#5 — key-aware samples for size/family/weight/tracking)
// ---------------------------------------------------------------------------

function renderTypographySample(key: string, value: string): string {
  const k = key.toLowerCase();
  const v = escHtml(value);

  if (k.includes('family') || k.includes('font-family')) {
    return `<span style="font-family:${v};font-size:14px;color:#e2e8f0">The quick brown fox</span>`;
  }
  if (k.includes('weight') || k.includes('font-weight')) {
    return `<span style="font-weight:${v};font-size:14px;color:#e2e8f0">Semibold Sample</span>`;
  }
  if (k.includes('letter-spacing') || k.includes('tracking')) {
    return `<span style="letter-spacing:${v};font-size:13px;color:#e2e8f0;text-transform:uppercase">TRACKING</span>`;
  }
  if (k.includes('line-height') || k.includes('leading')) {
    return `<span style="line-height:${v};font-size:13px;color:#e2e8f0;display:block">Line one<br>Line two</span>`;
  }
  // Font-size fallback: value looks like a CSS length
  if (/^[\d.]+(px|rem|em|pt|vw|vh|%)$/.test(value.trim())) {
    const capped = `min(${v}, 2rem)`;
    return `<span style="font-size:${capped};color:#e2e8f0">Aa Bb</span>`;
  }
  return v;
}

function renderTypographySection(typographyTokens: ResolvedToken[]): string {
  if (typographyTokens.length === 0) return '';
  const rows = typographyTokens
    .map(
      (t) => `<tr>
        <td data-copy="${escHtml(cssVarName(t.key))}">${escHtml(t.key)}</td>
        <td><code data-copy="${escHtml(t.value)}">${escHtml(t.value)}</code></td>
        <td>${renderTypographySample(t.key, t.value)}</td>
      </tr>`
    )
    .join('\n');
  return `<div class="subsection" id="sub-typography">
    <h3>Typography</h3>
    <div class="table-wrap"><table class="token-table">
      <thead><tr><th>Key</th><th>Value</th><th>Sample</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Shadows (#11 — preview on white box so shadow is visible)
// ---------------------------------------------------------------------------

function renderShadowSection(shadowTokens: ResolvedToken[]): string {
  if (shadowTokens.length === 0) return '';
  const rows = shadowTokens
    .map(
      (t) => `<tr>
        <td data-copy="${escHtml(cssVarName(t.key))}">${escHtml(t.key)}</td>
        <td><code data-copy="${escHtml(t.value)}">${escHtml(t.value)}</code></td>
        <td><div class="shadow-preview-wrap"><div class="shadow-preview" style="box-shadow:${escHtml(t.value)};"></div></div></td>
      </tr>`
    )
    .join('\n');
  return `<div class="subsection" id="sub-shadow">
    <h3>Shadow</h3>
    <div class="table-wrap"><table class="token-table">
      <thead><tr><th>Key</th><th>Value</th><th>Preview</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Generic key-value category
// ---------------------------------------------------------------------------

function renderGenericTokenSection(label: string, tokens: ResolvedToken[]): string {
  if (tokens.length === 0) return '';
  const rows = tokens
    .map(
      (t) =>
        `<tr>
          <td data-copy="${escHtml(cssVarName(t.key))}">${escHtml(t.key)}</td>
          <td><code data-copy="${escHtml(t.value)}">${escHtml(t.value)}</code></td>
        </tr>`
    )
    .join('\n');
  return `<div class="subsection" id="sub-${escHtml(label.toLowerCase())}">
    <h3>${escHtml(label)}</h3>
    <div class="table-wrap"><table class="token-table">
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Components (#2 — props always visible; #3 — labels; #7 — rules)
// ---------------------------------------------------------------------------

// A structured field may be an array (of strings or objects) OR an object map
// (e.g. { primary: { description } }). These helpers render either shape without
// assuming .map / .length on a non-array.

function fieldIsEmpty(v: unknown): boolean {
  if (Array.isArray(v)) return v.length === 0;
  if (v && typeof v === 'object') return Object.keys(v as object).length === 0;
  return true;
}

// Flatten any structured field into label/detail entries for chip or list rendering.
function toFieldEntries(v: unknown): Array<{ label: string; detail?: string }> {
  if (Array.isArray(v)) {
    return v.map((item) => {
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const label = (obj.name ?? obj.label ?? obj.key) as unknown;
        return {
          label: label != null ? String(label) : JSON.stringify(item),
          detail: JSON.stringify(item),
        };
      }
      return { label: String(item) };
    });
  }
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>).map(([k, val]) => ({
      label: k,
      detail: val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val),
    }));
  }
  return [];
}

function renderChips(v: unknown, chipClass: string): string {
  return toFieldEntries(v)
    .map((e) => `<span class="chip ${chipClass}"${e.detail ? ` title="${escHtml(e.detail)}"` : ''}>${escHtml(e.label)}</span>`)
    .join('');
}

function renderRuleList(v: unknown): string {
  const entries = toFieldEntries(v);
  if (!entries.length) return '';
  return `<ul class="rule-list">${entries
    .map((e) => `<li>${escHtml(e.label)}${e.detail && e.detail !== e.label ? `: ${escHtml(e.detail)}` : ''}</li>`)
    .join('')}</ul>`;
}

// Props: an array of {name,type,required} → the props table; an array of strings
// → chips; an object map → a key/definition table.
function renderProps(v: unknown): string {
  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    if (v.every((p) => p !== null && typeof p === 'object' && 'name' in (p as object))) {
      return renderPropsTable(v as ComponentProp[]);
    }
    return `<div class="chip-row">${renderChips(v, 'chip-variant')}</div>`;
  }
  if (v && typeof v === 'object') {
    const rows = Object.entries(v as Record<string, unknown>)
      .map(
        ([k, val]) =>
          `<tr><td class="prop-name">${escHtml(k)}</td><td>${escHtml(
            val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val)
          )}</td></tr>`
      )
      .join('');
    return `<table class="props-table"><thead><tr><th>Name</th><th>Definition</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Live preview — best-effort rendered sample(s) per component.
// The spec stores no implementation markup, so we synthesize a representative
// element from the component's NAME (its kind) and VARIANTS, styled with the
// project's design tokens. This is illustrative, not the component's real code.
// ---------------------------------------------------------------------------

type ComponentKind = 'button' | 'input' | 'badge' | 'avatar' | 'toggle' | 'card' | 'link' | 'generic';

function detectComponentKind(name: string): ComponentKind {
  const n = name.toLowerCase();
  if (/(button|btn|cta)/.test(n)) return 'button';
  if (/(input|field|textbox|textarea|search|select|dropdown)/.test(n)) return 'input';
  if (/(badge|tag|chip|pill|label|status)/.test(n)) return 'badge';
  if (/(avatar)/.test(n)) return 'avatar';
  if (/(toggle|switch|checkbox|radio)/.test(n)) return 'toggle';
  if (/(card|panel|tile|surface|container)/.test(n)) return 'card';
  if (/(link|anchor)/.test(n)) return 'link';
  return 'generic';
}

// Map a variant label to a CSS style string for button/badge fills.
function variantStyle(variant: string): string {
  const v = variant.toLowerCase();
  if (/(outline|ghost|text|link|tertiary|subtle|secondary)/.test(v))
    return 'background:transparent;border:1.5px solid var(--token-color-primary,#6366f1);color:var(--token-color-primary,#93c5fd);';
  if (/(danger|destructive|error)/.test(v))
    return 'background:#ef4444;border:1.5px solid #ef4444;color:#fff;';
  if (/(success|confirm)/.test(v))
    return 'background:#22c55e;border:1.5px solid #22c55e;color:#0b1120;';
  return 'background:var(--token-color-primary,#6366f1);border:1.5px solid var(--token-color-primary,#6366f1);color:#fff;';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'A';
}

function renderSampleElement(kind: ComponentKind, variant: string, name: string): string {
  const label = escHtml(name);
  switch (kind) {
    case 'button':
      return `<button type="button" class="lp-btn" style="${variantStyle(variant)}">${label}</button>`;
    case 'badge':
      return `<span class="lp-badge" style="${variantStyle(variant)}">${escHtml(variant || name)}</span>`;
    case 'input':
      return `<input class="lp-input" type="text" placeholder="${escHtml(variant || name)}" />`;
    case 'avatar':
      return `<div class="lp-avatar">${escHtml(initials(name))}</div>`;
    case 'toggle':
      return `<span class="lp-toggle" role="switch" aria-checked="true"></span>`;
    case 'card':
      return `<div class="lp-card">${label}</div>`;
    case 'link':
      return `<a class="lp-link" href="#" onclick="return false">${label}</a>`;
    default:
      return `<div class="lp-generic">${label}</div>`;
  }
}

function renderLivePreview(c: ResolvedComponentSpec): string {
  const kind = detectComponentKind(c.name);
  const variantLabels = toFieldEntries(c.variants).map((e) => e.label);
  const labels = variantLabels.length ? variantLabels : [''];
  const items = labels
    .map((l) => {
      const el = renderSampleElement(kind, l, c.name);
      const caption = l ? `<span class="lp-caption">${escHtml(l)}</span>` : '';
      return `<div class="lp-item">${el}${caption}</div>`;
    })
    .join('');
  return `<div class="card-section">
    <span class="card-section-label">Preview</span>
    <div class="lp-canvas">${items}</div>
  </div>`;
}

function renderComponentsSection(components: ResolvedComponentSpec[]): string {
  if (components.length === 0) return '';
  const cards = components
    .map((c) => {
      const accent = accentForComponent(c.name);

      // Live preview first, then the spec details.
      const sections: string[] = [renderLivePreview(c)];

      if (!fieldIsEmpty(c.variants)) {
        sections.push(`<div class="card-section">
          <span class="card-section-label">Variants</span>
          <div class="chip-row">${renderChips(c.variants, 'chip-variant')}</div>
        </div>`);
      }
      if (!fieldIsEmpty(c.states)) {
        sections.push(`<div class="card-section">
          <span class="card-section-label">States</span>
          <div class="chip-row">${renderChips(c.states, 'chip-state')}</div>
        </div>`);
      }
      if (!fieldIsEmpty(c.props)) {
        sections.push(`<div class="card-section">
          <span class="card-section-label">Props</span>
          ${renderProps(c.props)}
        </div>`);
      }
      if (!fieldIsEmpty(c.usageRules)) {
        sections.push(`<div class="card-section"><span class="card-section-label">Usage rules</span>${renderRuleList(c.usageRules)}</div>`);
      }
      if (!fieldIsEmpty(c.accessibilityNotes)) {
        sections.push(`<div class="card-section"><span class="card-section-label">Accessibility</span>${renderRuleList(c.accessibilityNotes)}</div>`);
      }

      const body = sections.length
        ? sections.join('\n')
        : '<p class="empty-note">No variants, states, or props defined yet.</p>';

      return `<div class="component-card">
        <div class="card-header" style="border-left: 4px solid ${accent}">
          <h3>${escHtml(c.name)}</h3>
          <span class="card-id">${escHtml(c.id)}</span>
        </div>
        ${c.description ? `<p class="card-desc">${escHtml(c.description)}</p>` : ''}
        ${body}
      </div>`;
    })
    .join('\n');
  return `<section id="components">
    <h2>Component Gallery</h2>
    <div class="components-grid">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Section: Patterns (#6 — line-clamp + title tooltip)
// ---------------------------------------------------------------------------

function renderPatternsSection(patterns: Pattern[]): string {
  if (patterns.length === 0) return '';
  const cards = patterns
    .map(
      (p) => `<div class="pattern-card">
          <div class="pattern-header">
            <h3>${escHtml(p.name)}</h3>
            <span class="badge badge-category">${escHtml(p.category)}</span>
          </div>
          ${p.description
            ? `<p class="clampable pattern-desc">${escHtml(p.description)}</p>
               <button type="button" class="expand-btn">Show more</button>`
            : ''}
        </div>`
    )
    .join('\n');
  return `<section id="patterns">
    <h2>Pattern Library</h2>
    <div class="patterns-grid">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Section: Guidelines (#8 — full body, not truncated)
// ---------------------------------------------------------------------------

function renderGuidelinesSection(guidelines: ShowcaseGuideline[]): string {
  if (guidelines.length === 0) return '';
  const cards = guidelines
    .map(
      (g) => `<div class="guideline-card">
          <h3>${escHtml(g.title)}</h3>
          ${g.tags.length ? `<div class="chip-row">${g.tags.map((t) => `<span class="chip chip-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
          <div class="clampable guideline-body">${escHtml(g.body)}</div>
          <button type="button" class="expand-btn">Show more</button>
        </div>`
    )
    .join('\n');
  return `<section id="guidelines">
    <h2>Design Guidelines</h2>
    <div class="guidelines-list">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// CSS custom properties
// ---------------------------------------------------------------------------

function buildCssVars(tokens: ResolvedToken[]): string {
  return tokens.map((t) => `  ${cssVarName(t.key)}: ${t.value};`).join('\n');
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function buildShowcaseHtml(opts: {
  project: Project;
  title: string;
  tokens: ResolvedToken[];
  components: ResolvedComponentSpec[];
  patterns: Pattern[];
  guidelines?: ShowcaseGuideline[];
}): string {
  const { project, title, tokens, components, patterns, guidelines = [] } = opts;

  const byCategory = (cat: string) => tokens.filter((t) => t.category === cat);
  const colorSection     = renderColorSection(tokens);           // uses all tokens
  const spacingSection   = renderSpacingSection(byCategory('spacing'));
  const typographySection = renderTypographySection(byCategory('typography'));
  const shadowSection    = renderShadowSection(byCategory('shadow'));
  const breakpointSection = renderBreakpointSection(byCategory('breakpoint'));
  const radiusSection    = renderGenericTokenSection('Radius',  byCategory('radius'));
  const borderSection    = renderGenericTokenSection('Border',  byCategory('border'));
  const motionSection    = renderGenericTokenSection('Motion',  byCategory('motion'));
  const otherSection     = renderGenericTokenSection('Other',
    byCategory('other').filter((t) => !isPureColor(t.value))  // pure-color 'other' tokens already in swatches
  );

  const cssVars = buildCssVars(tokens);

  const hasTokens     = tokens.length > 0;
  const hasComponents = components.length > 0;
  const hasPatterns   = patterns.length > 0;
  const hasGuidelines = guidelines.length > 0;

  const tokenCount     = tokens.length;
  const componentCount = components.length;
  const patternCount   = patterns.length;

  // In-section anchor links (#4) — one sub-link per non-empty token subsection.
  const tokenSubs = [
    { id: 'sub-colors',      label: 'Colors',      html: colorSection },
    { id: 'sub-typography',  label: 'Typography',  html: typographySection },
    { id: 'sub-spacing',     label: 'Spacing',     html: spacingSection },
    { id: 'sub-breakpoints', label: 'Breakpoints', html: breakpointSection },
    { id: 'sub-shadow',      label: 'Shadow',      html: shadowSection },
    { id: 'sub-radius',      label: 'Radius',      html: radiusSection },
    { id: 'sub-border',      label: 'Border',      html: borderSection },
    { id: 'sub-motion',      label: 'Motion',      html: motionSection },
    { id: 'sub-other',       label: 'Other',       html: otherSection },
  ].filter((s) => s.html);
  const tokenSubLinks = tokenSubs
    .map((s) => `<a class="sub-link" href="#${s.id}">${s.label}</a>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(title)}</title>
  <style>
    :root {
${cssVars}
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      line-height: 1.6;
    }

    /* ── Header ─────────────────────────────────────────────────────── */
    .site-header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
      flex-wrap: wrap;
    }
    .site-header .project-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .site-header .project-title {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    /* ── Layout ─────────────────────────────────────────────────────── */
    .layout {
      display: flex;
      max-width: 1280px;
      margin: 0 auto;
    }

    /* ── Side nav ───────────────────────────────────────────────────── */
    .side-nav {
      width: 200px;
      flex-shrink: 0;
      padding: 20px 12px;
      position: sticky;
      top: 49px;
      height: calc(100vh - 49px);
      overflow-y: auto;
      border-right: 1px solid #1e293b;
    }
    .side-nav a {
      display: block;
      padding: 7px 12px;
      color: #64748b;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.8rem;
      transition: background 0.12s, color 0.12s;
      white-space: nowrap;
    }
    .side-nav a:hover { background: #1e293b; color: #f1f5f9; }
    .side-nav a.active { background: #1e3a5f; color: #93c5fd; font-weight: 600; }
    .side-nav a.sub-link {
      padding: 4px 12px 4px 24px;
      font-size: 0.74rem;
      color: #475569;
    }
    .side-nav a.sub-link:hover { color: #cbd5e1; background: transparent; }

    /* ── Content ────────────────────────────────────────────────────── */
    .content {
      flex: 1;
      padding: 32px 24px;
      min-width: 0;
    }

    section { margin-bottom: 56px; }
    section > h2 {
      font-size: 1.4rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 24px;
      padding-bottom: 8px;
      border-bottom: 2px solid #334155;
    }

    .subsection { margin-bottom: 32px; }
    .subsection > h3 {
      color: #94a3b8;
      margin-bottom: 14px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 0.7rem;
      font-weight: 700;
    }

    /* ── Swatch grid ────────────────────────────────────────────────── */
    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 12px;
    }
    .swatch-card {
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #334155;
      cursor: pointer;
    }
    .swatch-card:hover { border-color: #475569; }
    .swatch-rect { width: 100%; height: 72px; }
    .swatch-meta { padding: 8px; }
    .swatch-css {
      display: block;
      font-size: 0.62rem;
      font-family: monospace;
      color: #475569;
      word-break: break-all;
      margin-bottom: 1px;
      cursor: pointer;
    }
    .swatch-css:hover { color: #7dd3fc; }
    .swatch-key {
      display: block;
      font-size: 0.7rem;
      color: #94a3b8;
      word-break: break-all;
      margin-bottom: 2px;
    }
    .swatch-value {
      display: block;
      font-size: 0.72rem;
      font-family: monospace;
      color: #e2e8f0;
      margin-bottom: 4px;
      cursor: pointer;
    }
    .swatch-value:hover { color: #7dd3fc; }
    .swatch-value-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
    }
    .copy-btn {
      flex-shrink: 0;
      background: #334155;
      border: none;
      color: #cbd5e1;
      font-size: 0.72rem;
      line-height: 1;
      padding: 4px 6px;
      border-radius: 5px;
      cursor: pointer;
      transition: background 0.12s, color 0.12s;
    }
    .copy-btn:hover { background: #475569; color: #f1f5f9; }
    .swatch-badge {
      display: inline-block;
      font-size: 0.58rem;
      padding: 1px 5px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-semantic { background: #312e81; color: #a5b4fc; }
    .badge-base     { background: #1e3a5f; color: #7dd3fc; }

    /* ── Token tables ───────────────────────────────────────────────── */
    .token-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
    }
    .token-table th {
      text-align: left;
      padding: 7px 12px;
      background: #1e293b;
      color: #64748b;
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .token-table td {
      padding: 7px 12px;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }
    .token-table td[data-copy] { cursor: pointer; }
    .token-table td[data-copy]:hover { color: #7dd3fc; }
    .token-table code {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      color: #7dd3fc;
      font-size: 0.78rem;
      cursor: pointer;
    }
    .token-table code:hover { color: #38bdf8; }

    /* ── Spacing bars ───────────────────────────────────────────────── */
    .spacing-bar {
      height: 12px;
      background: var(--token-color-primary, #6366f1);
      border-radius: 3px;
      min-width: 4px;
    }

    /* ── Shadow preview ─────────────────────────────────────────────── */
    /* Light backdrop with padding so the (usually dark) shadow has room to
       spread and contrast against — a white box on the dark page is invisible. */
    .shadow-preview-wrap {
      display: inline-block;
      background: #f1f5f9;
      padding: 20px;
      border-radius: 8px;
    }
    .shadow-preview {
      width: 80px;
      height: 48px;
      background: #ffffff;
      border-radius: 6px;
    }

    /* ── Breakpoints ────────────────────────────────────────────────── */
    .bp-list { display: flex; flex-direction: column; gap: 10px; }
    .bp-row  { display: flex; align-items: center; gap: 12px; }
    .bp-key  { width: 200px; flex-shrink: 0; font-size: 0.8rem; color: #94a3b8; cursor: pointer; }
    .bp-key:hover { color: #7dd3fc; }
    .bp-track { flex: 1; height: 10px; background: #1e293b; border-radius: 3px; overflow: hidden; }
    .bp-bar   { height: 100%; background: var(--token-color-primary, #6366f1); border-radius: 3px; }
    .bp-value { font-size: 0.78rem; font-family: monospace; color: #7dd3fc; width: 80px; flex-shrink: 0; cursor: pointer; }
    .bp-value:hover { color: #38bdf8; }

    /* ── Component grid ─────────────────────────────────────────────── */
    .components-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .component-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 20px;
      border: 1px solid #334155;
      min-width: 0;
    }
    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-left: 12px;
      margin-bottom: 10px;
    }
    .card-header h3 { font-size: 1rem; font-weight: 600; color: #f1f5f9; }
    .card-id { font-size: 0.68rem; color: #475569; font-family: monospace; }
    .card-desc { font-size: 0.85rem; color: #94a3b8; margin-bottom: 12px; overflow-wrap: anywhere; }
    .card-section { margin-bottom: 12px; }
    .card-section-label {
      display: block;
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #475569;
      margin-bottom: 6px;
    }
    .chip-row { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip {
      display: inline-block;
      font-size: 0.68rem;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 500;
    }
    .chip-variant { background: #0f3460; color: #93c5fd; }
    .chip-state   { background: #1a2e05; color: #86efac; }
    .chip-tag     { background: #292524; color: #d6d3d1; }
    .empty-note   { font-size: 0.75rem; color: #334155; font-style: italic; }
    .rule-list    { padding-left: 18px; font-size: 0.82rem; color: #94a3b8; }
    .rule-list li { margin-bottom: 3px; }

    /* ── Live preview (synthesized sample elements) ─────────────────── */
    .lp-canvas {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      align-items: flex-end;
      background: #0b1120;
      border: 1px solid #1e293b;
      border-radius: 8px;
      padding: 18px;
    }
    .lp-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .lp-caption {
      font-size: 0.6rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .lp-btn {
      font-size: 0.82rem;
      font-weight: 600;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
    }
    .lp-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 9999px;
    }
    .lp-input {
      font-size: 0.82rem;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #334155;
      background: #0f172a;
      color: #e2e8f0;
      min-width: 160px;
    }
    .lp-input::placeholder { color: #64748b; }
    .lp-avatar {
      width: 40px;
      height: 40px;
      border-radius: 9999px;
      background: var(--token-color-primary, #6366f1);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
    }
    .lp-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 16px 22px;
      color: #cbd5e1;
      font-size: 0.82rem;
      min-width: 120px;
      text-align: center;
    }
    .lp-link {
      color: var(--token-color-primary, #93c5fd);
      text-decoration: underline;
      font-size: 0.85rem;
    }
    .lp-toggle {
      width: 38px;
      height: 22px;
      border-radius: 9999px;
      background: var(--token-color-primary, #6366f1);
      position: relative;
      display: inline-block;
    }
    .lp-toggle::after {
      content: '';
      position: absolute;
      right: 2px;
      top: 2px;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #fff;
    }
    .lp-generic {
      border: 1px dashed #475569;
      border-radius: 8px;
      padding: 14px 20px;
      color: #94a3b8;
      font-size: 0.82rem;
    }

    /* ── Props table ────────────────────────────────────────────────── */
    .props-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.78rem;
      margin-top: 4px;
    }
    .props-table th {
      text-align: left;
      padding: 5px 10px;
      background: #0f172a;
      color: #475569;
      font-weight: 600;
      font-size: 0.65rem;
      text-transform: uppercase;
    }
    .props-table td {
      padding: 5px 10px;
      border-bottom: 1px solid #0f172a;
      color: #94a3b8;
    }
    .props-table code { font-family: monospace; color: #c084fc; font-size: 0.72rem; }
    .prop-name { color: #e2e8f0; font-weight: 500; }
    .badge-req { background: #7f1d1d; color: #fca5a5; font-size: 0.62rem; padding: 1px 6px; border-radius: 9999px; }
    .badge-opt { background: #1e293b; color: #475569; font-size: 0.62rem; padding: 1px 6px; border-radius: 9999px; }

    /* ── Pattern grid ───────────────────────────────────────────────── */
    .patterns-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .pattern-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #334155;
      min-width: 0;
    }
    .pattern-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .pattern-header h3 { font-size: 0.9rem; font-weight: 600; color: #f1f5f9; min-width: 0; }
    .badge {
      display: inline-block;
      font-size: 0.62rem;
      padding: 2px 7px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      flex-shrink: 0;
    }
    .badge-category { background: #1e3a5f; color: #38bdf8; }
    .pattern-desc { font-size: 0.8rem; color: #94a3b8; }

    /* ── Clamp + expand (patterns & guidelines) ─────────────────────── */
    .clampable {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .pattern-desc.clampable  { -webkit-line-clamp: 8; }
    .guideline-body.clampable { -webkit-line-clamp: 6; }
    .clampable.expanded {
      display: block;
      -webkit-line-clamp: unset;
    }
    .expand-btn {
      background: none;
      border: none;
      color: #7dd3fc;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 0 0;
    }
    .expand-btn:hover { color: #38bdf8; }

    /* ── Responsive table wrapper (#1 — horizontal scroll, no page overflow) ── */
    .table-wrap { width: 100%; overflow-x: auto; }

    /* ── Guidelines ─────────────────────────────────────────────────── */
    .guidelines-list { display: flex; flex-direction: column; gap: 16px; }
    .guideline-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 18px 20px;
      border: 1px solid #334155;
    }
    .guideline-card h3 { font-size: 0.95rem; font-weight: 600; color: #f1f5f9; margin-bottom: 6px; }
    .guideline-body {
      font-size: 0.85rem;
      color: #94a3b8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.65;
    }

    /* ── Copy toast ─────────────────────────────────────────────────── */
    #copy-toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #334155;
      color: #f1f5f9;
      font-size: 0.78rem;
      padding: 8px 16px;
      border-radius: 8px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
      z-index: 200;
    }
    #copy-toast.show { opacity: 1; }

    /* ── Footer ─────────────────────────────────────────────────────── */
    footer {
      text-align: center;
      padding: 24px;
      font-size: 0.72rem;
      color: #334155;
      border-top: 1px solid #1e293b;
      margin-top: 48px;
    }

    /* ── Mobile responsive (#1) ─────────────────────────────────────── */
    @media (max-width: 768px) {
      .layout { flex-direction: column; }

      .side-nav {
        width: 100%;
        position: static;
        height: auto;
        overflow-x: auto;
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        gap: 4px;
        padding: 10px 12px;
        border-right: none;
        border-bottom: 1px solid #1e293b;
      }

      .content { padding: 20px 16px; }

      .components-grid { grid-template-columns: 1fr; }
      .patterns-grid   { grid-template-columns: repeat(2, 1fr); }
      .swatch-grid     { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
      .bp-key          { width: 120px; }

      /* Touch targets ≥44px on mobile (WCAG 2.5.5) */
      .side-nav a {
        min-height: 44px;
        display: flex;
        align-items: center;
        padding: 8px 14px;
      }
      /* Keep the mobile nav bar compact — sub-links are desktop-only */
      .side-nav a.sub-link { display: none; }
    }

    @media (max-width: 480px) {
      .patterns-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <span class="project-name">${escHtml(project.name)}</span>
    <span class="project-title">${escHtml(title)}</span>
  </header>

  <div class="layout">
    <nav class="side-nav" id="side-nav">
      ${hasTokens      ? `<a href="#tokens">Tokens</a>${tokenSubLinks}` : ''}
      ${hasComponents  ? '<a href="#components">Components</a>'  : ''}
      ${hasPatterns    ? '<a href="#patterns">Patterns</a>'      : ''}
      ${hasGuidelines  ? '<a href="#guidelines">Guidelines</a>'  : ''}
    </nav>

    <main class="content">
      ${hasTokens ? `<section id="tokens">
        <h2>Design Tokens</h2>
        ${colorSection}
        ${typographySection}
        ${spacingSection}
        ${breakpointSection}
        ${shadowSection}
        ${radiusSection}
        ${borderSection}
        ${motionSection}
        ${otherSection}
      </section>` : ''}

      ${renderComponentsSection(components)}
      ${renderPatternsSection(patterns)}
      ${renderGuidelinesSection(guidelines)}
    </main>
  </div>

  <div id="copy-toast">Copied!</div>

  <footer>Generated by MPDS-MCP &middot; ${escHtml(project.id)} &middot; ${tokenCount} tokens &middot; ${componentCount} components &middot; ${patternCount} patterns</footer>

  <script>
    // ── Scroll-spy (#10) ───────────────────────────────────────────────
    (function () {
      var links = document.querySelectorAll('#side-nav a');
      var sections = Array.from(document.querySelectorAll('main section[id]'));
      if (!sections.length) return;

      var active = null;
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('active'); });
            var match = document.querySelector('#side-nav a[href="#' + e.target.id + '"]');
            if (match) { match.classList.add('active'); active = match; }
          }
        });
      }, { threshold: 0.15, rootMargin: '-48px 0px -60% 0px' });

      sections.forEach(function (s) { obs.observe(s); });
    })();

    // ── Click-to-copy (#12) ────────────────────────────────────────────
    (function () {
      var toast = document.getElementById('copy-toast');
      var timer = null;

      function showToast(text) {
        toast.textContent = 'Copied ✔ ' + text;
        toast.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(function () { toast.classList.remove('show'); }, 1800);
      }

      document.querySelectorAll('[data-copy]').forEach(function (el) {
        el.addEventListener('click', function (ev) {
          ev.stopPropagation();
          var text = el.getAttribute('data-copy');
          if (!text) return;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(function () { showToast(text); });
          } else {
            // Fallback for older browsers
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast(text);
          }
        });
      });
    })();

    // ── Expand / collapse clamped text (#5 guidelines, #7 patterns) ────
    (function () {
      document.querySelectorAll('.expand-btn').forEach(function (btn) {
        var target = btn.previousElementSibling;
        if (!target || !target.classList.contains('clampable')) { btn.style.display = 'none'; return; }
        // Only show the toggle when the text is actually clamped.
        if (target.scrollHeight <= target.clientHeight + 2) { btn.style.display = 'none'; return; }
        btn.addEventListener('click', function () {
          var expanded = target.classList.toggle('expanded');
          btn.textContent = expanded ? 'Show less' : 'Show more';
        });
      });
    })();
  </script>
</body>
</html>`;
}
