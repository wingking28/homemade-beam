import { Router } from 'express';
import { createExpense, getGroupExpenses, getGroupExpenseHistory, deleteExpense, settleShare } from '../controllers/expenses';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/groups/:groupId', authenticate, createExpense);
router.get('/groups/:groupId/history', authenticate, getGroupExpenseHistory);
router.get('/groups/:groupId', authenticate, getGroupExpenses);
router.put('/shares/:shareId/settle', authenticate, settleShare);
router.delete('/:id', authenticate, deleteExpense);

export default router;
