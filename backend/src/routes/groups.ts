import { Router } from 'express';
import {
  createGroup,
  getGroups,
  getGroup,
  addGroupMember,
  removeGroupMember,
  deleteGroup,
  getGroupBalances,
} from '../controllers/groups';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createGroup);
router.get('/', authenticate, getGroups);
router.get('/:id', authenticate, getGroup);
router.delete('/:id', authenticate, deleteGroup);
router.post('/:id/members', authenticate, addGroupMember);
router.delete('/:id/members/:userId', authenticate, removeGroupMember);
router.get('/:id/balances', authenticate, getGroupBalances);

export default router;
