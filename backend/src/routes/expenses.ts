import { Router } from 'express';
import { createExpense, getGroupExpenses, deleteExpense } from '../controllers/expenses';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/groups/:groupId', authenticate, createExpense);
router.get('/groups/:groupId', authenticate, getGroupExpenses);
router.delete('/:id', authenticate, deleteExpense);

export default router;
