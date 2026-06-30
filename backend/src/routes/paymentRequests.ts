import { Router } from 'express';
import {
  createPaymentRequest,
  getPaymentRequests,
  updatePaymentRequestStatus,
} from '../controllers/paymentRequests';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, createPaymentRequest);
router.get('/', authenticate, getPaymentRequests);
router.put('/:id', authenticate, updatePaymentRequestStatus);

export default router;
