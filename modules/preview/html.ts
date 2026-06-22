import { Project } from '../registry';
import { ResolvedToken } from '../tokens';
import { ResolvedComponentSpec, ComponentProp } from '../components';
import { Pattern } from '../patterns';

// ---------------------------------------------------------------------------
// HTML escape helper — always escape user data before inserting into HTML
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// CSS variable name from token key
// ---------------------------------------------------------------------------

function cssVarName(key: string): string {
  return '--token-' + key.replace(/\./g, '-');
}

// ---------------------------------------------------------------------------
// Component card accent color
// ---------------------------------------------------------------------------

function accentForComponent(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('button') || n.includes('btn')) return 'var(--token-color-primary, #6366f1)';
  if (n.includes('input') || n.includes('field') || n.includes('form')) return 'var(--token-color-secondary, #8b5cf6)';
  if (n.includes('modal') || n.includes('dialog')) return 'var(--token-color-accent, #ec4899)';
  return '#64748b';
}

// ---------------------------------------------------------------------------
// Props table renderer
// ---------------------------------------------------------------------------

function renderPropsTable(props: ComponentProp[]): string {
  if (props.length === 0) return '';
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
// Section: Color palette
// ---------------------------------------------------------------------------

function renderColorSection(colorTokens: ResolvedToken[]): string {
  if (colorTokens.length === 0) return '';
  const cards = colorTokens
    .map(
      (t) => `<div class="swatch-card">
        <div class="swatch-rect" style="background: ${escHtml(t.value)}; border-radius: 6px; height: 80px;"></div>
        <div class="swatch-meta">
          <span class="swatch-key">${escHtml(t.key)}</span>
          <span class="swatch-value">${escHtml(t.value)}</span>
          <span class="swatch-badge ${t.isSemantic ? 'badge-semantic' : 'badge-base'}">${escHtml(t.source)}</span>
        </div>
      </div>`
    )
    .join('\n');
  return `<div class="subsection">
    <h3>Color Palette</h3>
    <div class="swatch-grid">${cards}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Spacing tokens
// ---------------------------------------------------------------------------

function renderSpacingSection(spacingTokens: ResolvedToken[]): string {
  if (spacingTokens.length === 0) return '';
  const rows = spacingTokens
    .map((t) => {
      const px = parseFloat(t.value);
      const barWidth = isNaN(px) ? 4 : Math.max(4, Math.min(px / 4, 200));
      const bar = `<div style="width:${barWidth}px; height:8px; background:var(--token-color-primary,#6366f1); border-radius:2px;"></div>`;
      return `<tr>
        <td>${escHtml(t.key)}</td>
        <td><code>${escHtml(t.value)}</code></td>
        <td>${bar}</td>
      </tr>`;
    })
    .join('\n');
  return `<div class="subsection">
    <h3>Spacing</h3>
    <table class="token-table">
      <thead><tr><th>Key</th><th>Value</th><th>Visual</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Typography tokens
// ---------------------------------------------------------------------------

function renderTypographySection(typographyTokens: ResolvedToken[]): string {
  if (typographyTokens.length === 0) return '';
  const rows = typographyTokens
    .map((t) => {
      // If value looks like a font size (e.g., "16px", "1.5rem", "24"), show sample text
      const looksLikeSize = /^[\d.]+(px|rem|em|pt|%)$/.test(t.value.trim());
      const sample = looksLikeSize
        ? `<span style="font-size:${escHtml(t.value)}">Aa Bb Cc</span>`
        : escHtml(t.value);
      return `<tr>
        <td>${escHtml(t.key)}</td>
        <td><code>${escHtml(t.value)}</code></td>
        <td>${sample}</td>
      </tr>`;
    })
    .join('\n');
  return `<div class="subsection">
    <h3>Typography</h3>
    <table class="token-table">
      <thead><tr><th>Key</th><th>Value</th><th>Sample</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Generic key-value token category
// ---------------------------------------------------------------------------

function renderGenericTokenSection(label: string, tokens: ResolvedToken[]): string {
  if (tokens.length === 0) return '';
  const rows = tokens
    .map(
      (t) =>
        `<tr>
          <td>${escHtml(t.key)}</td>
          <td><code>${escHtml(t.value)}</code></td>
        </tr>`
    )
    .join('\n');
  return `<div class="subsection">
    <h3>${escHtml(label)}</h3>
    <table class="token-table">
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

// ---------------------------------------------------------------------------
// Section: Component gallery
// ---------------------------------------------------------------------------

function renderComponentsSection(components: ResolvedComponentSpec[]): string {
  if (components.length === 0) return '';
  const cards = components
    .map((c) => {
      const accent = accentForComponent(c.name);
      const variantChips = c.variants
        .map((v) => `<span class="chip chip-variant">${escHtml(v)}</span>`)
        .join('');
      const stateChips = c.states
        .map((s) => `<span class="chip chip-state">${escHtml(s)}</span>`)
        .join('');
      return `<div class="component-card">
        <div class="card-header" style="border-left: 4px solid ${accent}">
          <h3>${escHtml(c.name)}</h3>
          <span class="card-id">${escHtml(c.id)}</span>
        </div>
        <p class="card-desc">${c.description ? escHtml(c.description) : ''}</p>
        <div class="chip-row">${variantChips}</div>
        <div class="chip-row">${stateChips}</div>
        ${c.props.length > 0 ? renderPropsTable(c.props) : ''}
      </div>`;
    })
    .join('\n');
  return `<section id="components">
    <h2>Component Gallery</h2>
    <div class="components-grid">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Section: Pattern library
// ---------------------------------------------------------------------------

function renderPatternsSection(patterns: Pattern[]): string {
  if (patterns.length === 0) return '';
  const cards = patterns
    .map(
      (p) =>
        `<div class="pattern-card">
          <div class="pattern-header">
            <h3>${escHtml(p.name)}</h3>
            <span class="badge badge-category">${escHtml(p.category)}</span>
          </div>
          <p>${p.description ? escHtml(p.description) : ''}</p>
        </div>`
    )
    .join('\n');
  return `<section id="patterns">
    <h2>Pattern Library</h2>
    <div class="patterns-grid">${cards}</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// CSS custom properties from tokens
// ---------------------------------------------------------------------------

function buildCssVars(tokens: ResolvedToken[]): string {
  return tokens
    .map((t) => `  ${cssVarName(t.key)}: ${t.value};`)
    .join('\n');
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
}): string {
  const { project, title, tokens, components, patterns } = opts;

  // Group tokens by category
  const byCategory = (cat: string) => tokens.filter((t) => t.category === cat);
  const colorTokens = byCategory('color');
  const spacingTokens = byCategory('spacing');
  const typographyTokens = byCategory('typography');
  const radiusTokens = byCategory('radius');
  const shadowTokens = byCategory('shadow');
  const breakpointTokens = byCategory('breakpoint');

  const cssVars = buildCssVars(tokens);
  const tokenCount = tokens.length;
  const componentCount = components.length;
  const patternCount = patterns.length;

  const hasTokens = tokenCount > 0;
  const hasComponents = componentCount > 0;
  const hasPatterns = patternCount > 0;

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

    /* ---- Header ---- */
    .site-header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 16px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .site-header .project-name {
      font-size: 1.25rem;
      font-weight: 700;
      color: #f8fafc;
    }
    .site-header .project-title {
      font-size: 0.875rem;
      color: #94a3b8;
    }

    /* ---- Layout ---- */
    .layout {
      display: flex;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* ---- Side nav ---- */
    .side-nav {
      width: 200px;
      flex-shrink: 0;
      padding: 24px 16px;
      position: sticky;
      top: 57px;
      height: calc(100vh - 57px);
      overflow-y: auto;
      border-right: 1px solid #1e293b;
    }
    .side-nav a {
      display: block;
      padding: 8px 12px;
      color: #94a3b8;
      text-decoration: none;
      border-radius: 6px;
      font-size: 0.875rem;
      transition: background 0.15s, color 0.15s;
    }
    .side-nav a:hover {
      background: #1e293b;
      color: #f1f5f9;
    }

    /* ---- Content ---- */
    .content {
      flex: 1;
      padding: 32px 24px;
      min-width: 0;
    }

    section {
      margin-bottom: 48px;
    }

    section > h2 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 24px;
      padding-bottom: 8px;
      border-bottom: 2px solid #334155;
    }

    .subsection {
      margin-bottom: 32px;
    }
    .subsection > h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      font-size: 0.75rem;
    }

    /* ---- Swatch grid ---- */
    .swatch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
    }
    .swatch-card {
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    .swatch-rect {
      width: 100%;
    }
    .swatch-meta {
      padding: 8px;
    }
    .swatch-key {
      display: block;
      font-size: 0.7rem;
      color: #94a3b8;
      word-break: break-all;
      margin-bottom: 2px;
    }
    .swatch-value {
      display: block;
      font-size: 0.75rem;
      font-family: monospace;
      color: #e2e8f0;
      margin-bottom: 4px;
    }
    .swatch-badge {
      display: inline-block;
      font-size: 0.6rem;
      padding: 2px 6px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-semantic {
      background: #312e81;
      color: #a5b4fc;
    }
    .badge-base {
      background: #1e3a5f;
      color: #7dd3fc;
    }

    /* ---- Token tables ---- */
    .token-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    .token-table th {
      text-align: left;
      padding: 8px 12px;
      background: #1e293b;
      color: #94a3b8;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .token-table td {
      padding: 8px 12px;
      border-bottom: 1px solid #1e293b;
      color: #cbd5e1;
    }
    .token-table code {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      color: #7dd3fc;
      font-size: 0.8rem;
    }

    /* ---- Component grid ---- */
    .components-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    @media (max-width: 768px) {
      .components-grid { grid-template-columns: 1fr; }
    }
    .component-card {
      background: #1e293b;
      border-radius: 10px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .card-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      padding-left: 12px;
      margin-bottom: 8px;
    }
    .card-header h3 {
      font-size: 1rem;
      font-weight: 600;
      color: #f1f5f9;
    }
    .card-id {
      font-size: 0.7rem;
      color: #64748b;
      font-family: monospace;
    }
    .card-desc {
      font-size: 0.875rem;
      color: #94a3b8;
      margin-bottom: 12px;
      min-height: 1.4em;
    }
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 8px;
    }
    .chip {
      display: inline-block;
      font-size: 0.7rem;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 500;
    }
    .chip-variant {
      background: #0f3460;
      color: #93c5fd;
    }
    .chip-state {
      background: #1a2e05;
      color: #86efac;
    }

    /* ---- Props table ---- */
    .props-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      margin-top: 8px;
    }
    .props-table th {
      text-align: left;
      padding: 6px 10px;
      background: #0f172a;
      color: #64748b;
      font-weight: 600;
      font-size: 0.7rem;
      text-transform: uppercase;
    }
    .props-table td {
      padding: 6px 10px;
      border-bottom: 1px solid #0f172a;
      color: #94a3b8;
    }
    .props-table code {
      font-family: monospace;
      color: #c084fc;
      font-size: 0.75rem;
    }
    .prop-name { color: #e2e8f0; font-weight: 500; }
    .badge-req {
      background: #7f1d1d;
      color: #fca5a5;
      font-size: 0.65rem;
      padding: 1px 6px;
      border-radius: 9999px;
    }
    .badge-opt {
      background: #1e293b;
      color: #64748b;
      font-size: 0.65rem;
      padding: 1px 6px;
      border-radius: 9999px;
    }

    /* ---- Pattern grid ---- */
    .patterns-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    @media (max-width: 900px) {
      .patterns-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 600px) {
      .patterns-grid { grid-template-columns: 1fr; }
    }
    .pattern-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #334155;
    }
    .pattern-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .pattern-header h3 {
      font-size: 0.95rem;
      font-weight: 600;
      color: #f1f5f9;
    }
    .badge {
      display: inline-block;
      font-size: 0.65rem;
      padding: 2px 8px;
      border-radius: 9999px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-category {
      background: #1e3a5f;
      color: #38bdf8;
    }
    .pattern-card p {
      font-size: 0.8rem;
      color: #94a3b8;
    }

    /* ---- Footer ---- */
    footer {
      text-align: center;
      padding: 24px;
      font-size: 0.75rem;
      color: #475569;
      border-top: 1px solid #1e293b;
      margin-top: 48px;
    }
  </style>
</head>
<body>
  <header class="site-header">
    <span class="project-name">${escHtml(project.name)}</span>
    <span class="project-title">${escHtml(title)}</span>
  </header>

  <div class="layout">
    <nav class="side-nav">
      ${hasTokens ? '<a href="#tokens">Design Tokens</a>' : ''}
      ${hasComponents ? '<a href="#components">Components</a>' : ''}
      ${hasPatterns ? '<a href="#patterns">Patterns</a>' : ''}
    </nav>

    <main class="content">
      ${hasTokens ? `<section id="tokens">
        <h2>Design Tokens</h2>
        ${renderColorSection(colorTokens)}
        ${renderSpacingSection(spacingTokens)}
        ${renderTypographySection(typographyTokens)}
        ${renderGenericTokenSection('Radius', radiusTokens)}
        ${renderGenericTokenSection('Shadow', shadowTokens)}
        ${renderGenericTokenSection('Breakpoint', breakpointTokens)}
      </section>` : ''}

      ${renderComponentsSection(components)}

      ${renderPatternsSection(patterns)}
    </main>
  </div>

  <footer>Generated by MPDS-MCP &middot; Project: ${escHtml(project.id)} &middot; ${tokenCount} tokens &middot; ${componentCount} components &middot; ${patternCount} patterns</footer>
</body>
</html>`;
}
