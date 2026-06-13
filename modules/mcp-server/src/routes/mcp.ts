import { Router, Request, Response } from 'express';
import { listProjects } from '../../../registry/index';
import { resolveTokens } from '../../../tokens/index';
import { listSpecs, getSpec } from '../../../components/index';
import { validateColorPair, validateSnippet, ValidateError } from '../../../validate/index';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== '2.0' || !method) {
    res.json({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    });
    return;
  }

  try {
    let result: unknown;

    switch (method) {
      case 'list_projects': {
        result = await listProjects();
        break;
      }

      case 'get_design_system': {
        if (!params?.projectId) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'projectId is required' } });
          return;
        }
        const [tokens, components] = await Promise.all([
          resolveTokens(params.projectId as string),
          listSpecs(params.projectId as string),
        ]);
        result = { tokens, components };
        break;
      }

      case 'get_tokens': {
        if (!params?.projectId) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'projectId is required' } });
          return;
        }
        result = await resolveTokens(params.projectId as string, params.category as string | undefined);
        break;
      }

      case 'get_component_spec': {
        if (!params?.projectId || !params?.componentId) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'projectId and componentId are required' } });
          return;
        }
        result = await getSpec(params.projectId as string, params.componentId as string);
        break;
      }

      case 'validate_color_pair': {
        if (!params?.fg || !params?.bg || !params?.context) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'fg, bg, and context are required' } });
          return;
        }
        result = validateColorPair(params.fg as string, params.bg as string, params.context as 'normal' | 'large' | 'ui');
        break;
      }

      case 'validate_token_pair': {
        if (!params?.projectId || !params?.fgKey || !params?.bgKey || !params?.context) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'projectId, fgKey, bgKey, and context are required' } });
          return;
        }
        const tokensArr = await resolveTokens(params.projectId as string);
        const fgToken = tokensArr.find((t) => t.key === params.fgKey);
        const bgToken = tokensArr.find((t) => t.key === params.bgKey);
        if (!fgToken) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: `Token '${params.fgKey}' not found` } });
          return;
        }
        if (!bgToken) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32603, message: `Token '${params.bgKey}' not found` } });
          return;
        }
        result = validateColorPair(fgToken.value, bgToken.value, params.context as 'normal' | 'large' | 'ui');
        break;
      }

      case 'validate_snippet': {
        if (!params?.content) {
          res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'content is required' } });
          return;
        }
        result = validateSnippet({ content: params.content as string, contentType: params.contentType as 'html' | 'jsx' | undefined });
        break;
      }

      default: {
        res.json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        });
        return;
      }
    }

    res.json({ jsonrpc: '2.0', id, result });
  } catch (err: any) {
    res.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: 'Internal server error' },
    });
  }
});

export default router;
