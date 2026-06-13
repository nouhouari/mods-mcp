import { Router, Request, Response } from 'express';
import { listSpecs, getSpec, setOverride, deleteOverride, ComponentsError } from '../../../components/index';

const router = Router({ mergeParams: true });

const COMPONENTS_STATUS: Record<string, number> = {
  COMPONENT_NOT_FOUND: 404,
  DUPLICATE_COMPONENT_ID: 400,
  INVALID_OVERRIDE_FIELD: 400,
  CONFLICT: 409,
  PROJECT_NOT_FOUND: 404,
};

function handleComponentsError(err: unknown, res: Response): boolean {
  if (err instanceof ComponentsError) {
    const status = COMPONENTS_STATUS[err.code] ?? 500;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return true;
  }
  return false;
}

router.get('/:projectId/components', async (req: Request, res: Response) => {
  try {
    const specs = await listSpecs(req.params['projectId'] as string);
    res.json(specs);
  } catch (err) {
    if (!handleComponentsError(err, res)) {
      console.error('[components] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

router.get('/:projectId/components/:componentId', async (req: Request, res: Response) => {
  try {
    const spec = await getSpec(req.params['projectId'] as string, req.params['componentId'] as string);
    res.json(spec);
  } catch (err) {
    if (!handleComponentsError(err, res)) {
      console.error('[components] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

router.put('/:projectId/components/:componentId/override', async (req: Request, res: Response) => {
  try {
    const spec = await setOverride(req.params['projectId'] as string, req.params['componentId'] as string, req.body);
    res.json(spec);
  } catch (err) {
    if (!handleComponentsError(err, res)) {
      console.error('[components] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

router.delete('/:projectId/components/:componentId/override', async (req: Request, res: Response) => {
  try {
    await deleteOverride(req.params['projectId'] as string, req.params['componentId'] as string);
    res.status(204).send();
  } catch (err) {
    if (!handleComponentsError(err, res)) {
      console.error('[components] unexpected error:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    }
  }
});

export default router;
