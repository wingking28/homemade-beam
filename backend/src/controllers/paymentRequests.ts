import { Response } from 'express';
import { z } from 'zod';
import { PaymentRequestStatus } from '@prisma/client';
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
  const { type = 'all', status, search } = req.query as {
    type?: 'sent' | 'received' | 'all';
    status?: 'active' | 'inactive';
    search?: string;
  };
  const order = req.query.order === 'asc' ? ('asc' as const) : ('desc' as const);
  const paginate = req.query.page !== undefined || req.query.limit !== undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
  const searchTerm = search?.trim();

  const typeWhere =
    type === 'sent'
      ? { senderId: req.userId }
      : type === 'received'
        ? { receiverId: req.userId }
        : { OR: [{ senderId: req.userId }, { receiverId: req.userId }] };

  const statusWhere =
    status === 'active'
      ? { status: PaymentRequestStatus.PENDING }
      : status === 'inactive'
        ? { status: { in: [PaymentRequestStatus.PAID, PaymentRequestStatus.CANCELLED] } }
        : {};

  const searchWhere = searchTerm
    ? {
        OR: [
          { description: { contains: searchTerm, mode: 'insensitive' as const } },
          { sender: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
          { receiver: { name: { contains: searchTerm, mode: 'insensitive' as const } } },
        ],
      }
    : {};

  const where = { AND: [typeWhere, statusWhere, searchWhere] };

  const [requests, total] = await Promise.all([
    prisma.paymentRequest.findMany({
      where,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        receiver: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: order },
      ...(paginate ? { skip: (page - 1) * limit, take: limit } : {}),
    }),
    prisma.paymentRequest.count({ where }),
  ]);

  res.json({
    requests,
    total,
    page: paginate ? page : 1,
    limit: paginate ? limit : total,
    hasMore: paginate ? page * limit < total : false,
  });
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
