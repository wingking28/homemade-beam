import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  // optional: if not provided, split equally among all group members
  splits: z
    .array(z.object({ userId: z.string(), amount: z.number().positive() }))
    .optional(),
});

export async function createExpense(req: AuthRequest, res: Response): Promise<void> {
  const { groupId } = req.params;
  const result = createExpenseSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { description, amount, splits } = result.data;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }

  let shareData: { userId: string; amount: number }[];

  if (splits && splits.length > 0) {
    shareData = splits;
  } else {
    // Equal split among all group members
    const members = await prisma.groupMember.findMany({ where: { groupId } });
    const share = Math.round((amount / members.length) * 100) / 100;
    const remainder = Math.round((amount - share * members.length) * 100) / 100;
    shareData = members.map((m, i) => ({
      userId: m.userId,
      amount: i === 0 ? share + remainder : share,
    }));
  }

  const expense = await prisma.expense.create({
    data: {
      groupId,
      paidById: req.userId!,
      description,
      amount,
      shares: {
        create: shareData.map((s) => ({ userId: s.userId, amount: s.amount })),
      },
    },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      shares: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
  });

  res.status(201).json({ expense });
}

export async function getGroupExpenses(req: AuthRequest, res: Response): Promise<void> {
  const { groupId } = req.params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: {
      paidBy: { select: { id: true, name: true, avatarUrl: true } },
      shares: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ expenses });
}

export async function getGroupExpenseHistory(req: AuthRequest, res: Response): Promise<void> {
  const { groupId } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const order = req.query.order === 'asc' ? ('asc' as const) : ('desc' as const);

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });
  if (!membership) {
    res.status(403).json({ error: 'Not a member of this group' });
    return;
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where: { groupId, isSettled: true },
      include: {
        paidBy: { select: { id: true, name: true, avatarUrl: true } },
        shares: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where: { groupId, isSettled: true } }),
  ]);

  res.json({ expenses, total, page, limit, hasMore: page * limit < total });
}

export async function settleShare(req: AuthRequest, res: Response): Promise<void> {
  const share = await prisma.expenseShare.findUnique({ where: { id: req.params.shareId } });
  if (!share) {
    res.status(404).json({ error: 'Share not found' });
    return;
  }
  if (share.userId !== req.userId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const updated = await prisma.expenseShare.update({
    where: { id: req.params.shareId },
    data: { isPaid: true },
  });

  // Check if all non-payer shares are now paid → mark expense as settled
  const expense = await prisma.expense.findUnique({
    where: { id: share.expenseId },
    select: {
      paidById: true,
      isSettled: true,
      shares: { select: { userId: true, isPaid: true } },
    },
  });
  if (expense && !expense.isSettled) {
    const allNonPayerPaid = expense.shares
      .filter((s) => s.userId !== expense.paidById)
      .every((s) => s.isPaid);
    if (allNonPayerPaid) {
      await prisma.expense.update({
        where: { id: share.expenseId },
        data: { isSettled: true },
      });
    }
  }

  res.json({ share: updated });
}

export async function deleteExpense(req: AuthRequest, res: Response): Promise<void> {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) {
    res.status(404).json({ error: 'Expense not found' });
    return;
  }

  const isPayer = expense.paidById === req.userId;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: expense.groupId, userId: req.userId! } },
  });
  const isAdmin = membership?.role === 'ADMIN';

  if (!isPayer && !isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await prisma.expense.delete({ where: { id: req.params.id } });
  res.json({ success: true });
}
