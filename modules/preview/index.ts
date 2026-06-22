import { getProject } from '../registry';
import { resolveTokens } from '../tokens';
import { listSpecs } from '../components';
import { listPatterns } from '../patterns';
import { buildShowcaseHtml } from './html';

export class PreviewError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PreviewError';
  }
}

export async function generateShowcase(
  projectId: string,
  title?: string
): Promise<{ html: string; tokenCount: number; componentCount: number; patternCount: number }> {
  const project = await getProject(projectId); // throws RegistryError if not found
  const tokens = await resolveTokens(projectId);
  const components = await listSpecs(projectId);
  const patternsResult = await listPatterns(projectId, { limit: 200, offset: 0 });

  // listPatterns returns { patterns: Pattern[], total, limit, offset }
  const patterns = patternsResult.patterns ?? [];

  const html = buildShowcaseHtml({
    project,
    title: title ?? (project.name + ' Design System'),
    tokens,
    components,
    patterns,
  });

  return {
    html,
    tokenCount: tokens.length,
    componentCount: components.length,
    patternCount: patterns.length,
  };
}
