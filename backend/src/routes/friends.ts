import { Router } from 'express';
import {
  sendFriendRequest,
  getFriendRequests,
  respondToFriendRequest,
  getFriends,
  removeFriend,
} from '../controllers/friends';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/request', authenticate, sendFriendRequest);
router.get('/requests', authenticate, getFriendRequests);
router.put('/requests/:id', authenticate, respondToFriendRequest);
router.get('/', authenticate, getFriends);
router.delete('/:friendId', authenticate, removeFriend);

export default router;
