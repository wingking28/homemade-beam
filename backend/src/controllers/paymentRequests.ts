import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

const createSchema = z.object({
  receiverId: z.string(),
  amount: z.number().positive(),
  description: z.string().min(1),
});

export async function createPaymentRequest(req: AuthRequest, res: Response): Promise<void> {
  const result = createSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { receiverId, amount, description } = result.data;

  if (receiverId === req.userId) {
    res.status(400).json({ error: 'Cannot request payment from yourself' });
    return;
  }

  const request = await prisma.paymentRequest.create({
    data: { senderId: req.userId!, receiverId, amount, description },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  res.status(201).json({ request });
}

export async function getPaymentRequests(req: AuthRequest, res: Response): Promise<void> {
  const { type = 'all' } = req.query as { type?: 'sent' | 'received' | 'all' };

  const where =
    type === 'sent'
      ? { senderId: req.userId }
      : type === 'received'
        ? { receiverId: req.userId }
        : { OR: [{ senderId: req.userId }, { receiverId: req.userId }] };

  const requests = await prisma.paymentRequest.findMany({
    where,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ requests });
}

export async function updatePaymentRequestStatus(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = z
    .object({ status: z.enum(['PAID', 'CANCELLED']) })
    .parse(req.body);

  const request = await prisma.paymentRequest.findUnique({ where: { id } });
  if (!request) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  // Only the receiver can mark as paid; sender or receiver can cancel
  if (status === 'PAID' && request.receiverId !== req.userId) {
    res.status(403).json({ error: 'Only the receiver can mark as paid' });
    return;
  }
  if (
    status === 'CANCELLED' &&
    request.senderId !== req.userId &&
    request.receiverId !== req.userId
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const updated = await prisma.paymentRequest.update({
    where: { id },
    data: { status },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  res.json({ request: updated });
}
