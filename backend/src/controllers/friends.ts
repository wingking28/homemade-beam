import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';

export async function sendFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  const { receiverId } = z.object({ receiverId: z.string() }).parse(req.body);

  if (receiverId === req.userId) {
    res.status(400).json({ error: 'Cannot send friend request to yourself' });
    return;
  }

  const existing = await prisma.friendRequest.findFirst({
    where: {
      OR: [
        { senderId: req.userId, receiverId },
        { senderId: receiverId, receiverId: req.userId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'ACCEPTED') {
      res.status(409).json({ error: 'Already friends', request: existing });
      return;
    }
    if (existing.status === 'PENDING') {
      res.status(409).json({ error: 'Friend request already pending', request: existing });
      return;
    }
    // DECLINED — delete the old record so a fresh request can be created
    await prisma.friendRequest.delete({ where: { id: existing.id } });
  }

  const request = await prisma.friendRequest.create({
    data: { senderId: req.userId!, receiverId },
    include: { receiver: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  res.status(201).json({ request });
}

export async function getFriendRequests(req: AuthRequest, res: Response): Promise<void> {
  const requests = await prisma.friendRequest.findMany({
    where: { receiverId: req.userId, status: 'PENDING' },
    include: { sender: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ requests });
}

export async function respondToFriendRequest(req: AuthRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { action } = z.object({ action: z.enum(['accept', 'decline']) }).parse(req.body);

  const request = await prisma.friendRequest.findUnique({ where: { id } });
  if (!request || request.receiverId !== req.userId) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const updated = await prisma.friendRequest.update({
    where: { id },
    data: { status: action === 'accept' ? 'ACCEPTED' : 'DECLINED' },
  });

  res.json({ request: updated });
}

export async function getFriends(req: AuthRequest, res: Response): Promise<void> {
  const accepted = await prisma.friendRequest.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [{ senderId: req.userId }, { receiverId: req.userId }],
    },
    include: {
      sender: { select: { id: true, name: true, email: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  const friends = accepted.map((r) =>
    r.senderId === req.userId ? r.receiver : r.sender
  );

  res.json({ friends });
}

export async function removeFriend(req: AuthRequest, res: Response): Promise<void> {
  const { friendId } = req.params;

  await prisma.friendRequest.deleteMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { senderId: req.userId, receiverId: friendId },
        { senderId: friendId, receiverId: req.userId },
      ],
    },
  });

  res.json({ success: true });
}
