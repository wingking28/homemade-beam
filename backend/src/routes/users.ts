import { Router } from 'express';
import { searchUsers } from '../controllers/users';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/search', authenticate, searchUsers);

export default router;
