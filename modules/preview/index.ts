import { getProject } from '../registry';
import { resolveTokens } from '../tokens';
import { listSpecs } from '../components';
import { listPatterns } from '../patterns';
import { buildShowcaseHtml, ShowcaseGuideline } from './html';
import { getDb } from '../db';

export class PreviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PreviewError';
  }
}

export async function generateShowcase(
  projectId: string,
  title?: string
): Promise<{ html: string; tokenCount: number; componentCount: number; patternCount: number; guidelineCount: number }> {
  const project = await getProject(projectId); // throws RegistryError if not found
  const tokens = await resolveTokens(projectId);
  const components = await listSpecs(projectId);
  const patternsResult = await listPatterns(projectId, { limit: 200, offset: 0 });

  // listPatterns returns { patterns: Pattern[], total, limit, offset }
  const patterns = patternsResult.patterns ?? [];

  // Query all guidelines — table may not exist yet on fresh DBs, so catch safely
  let guidelines: ShowcaseGuideline[] = [];
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, title, body, tags FROM guidelines ORDER BY created_at DESC'
    ).all() as Array<{ id: string; title: string; body: string; tags: string }>;
    guidelines = rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      tags: (() => { try { return JSON.parse(r.tags || '[]') as string[]; } catch { return []; } })(),
    }));
  } catch {
    // guidelines table absent — omit section from showcase
  }

  const html = buildShowcaseHtml({
    project,
    title: title ?? (project.name + ' Design System'),
    tokens,
    components,
    patterns,
    guidelines,
  });

  return {
    html,
    tokenCount: tokens.length,
    componentCount: components.length,
    patternCount: patterns.length,
    guidelineCount: guidelines.length,
  };
}
