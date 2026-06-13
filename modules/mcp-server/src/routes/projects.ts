import { Router, Request, Response } from 'express';
import {
  createProject,
  getProject,
  listProjects,
  updateProject,
  deleteProject,
  RegistryError,
} from '../../../registry/index';

const router = Router();

const REGISTRY_STATUS: Record<string, number> = {
  PROJECT_NOT_FOUND: 404,
  DUPLICATE_PROJECT_ID: 400,
  MAX_INHERITANCE_DEPTH: 400,
  BASE_HAS_CHILDREN: 400,
  PROJECT_HAS_TOKENS: 400,
};

function handleRegistryError(err: unknown, res: Response): boolean {
  if (err instanceof RegistryError) {
    const status = REGISTRY_STATUS[err.code] ?? 500;
    res.status(status).json({ error: { code: err.code, message: err.message } });
    return true;
  }
  return false;
}

router.get('/', async (_req: Request, res: Response) => {
  try {
    const projects = await listProjects();
    res.json(projects);
  } catch (err) {
    if (!handleRegistryError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const project = await createProject(req.body);
    res.status(201).json(project);
  } catch (err) {
    if (!handleRegistryError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const project = await getProject(req.params['id'] as string);
    res.json(project);
  } catch (err) {
    if (!handleRegistryError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const project = await updateProject(req.params['id'] as string, req.body);
    res.json(project);
  } catch (err) {
    if (!handleRegistryError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteProject(req.params['id'] as string);
    res.status(204).send();
  } catch (err) {
    if (!handleRegistryError(err, res)) {
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: String(err) } });
    }
  }
});

export default router;
