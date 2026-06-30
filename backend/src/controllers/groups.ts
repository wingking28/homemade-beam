import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export async function createGroup(req: AuthRequest, res: Response): Promise<void> {
  const schema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    memberIds: z.array(z.string()).optional(),
  });
  const { name, description, memberIds = [] } = schema.parse(req.body);

  const group = await prisma.group.create({
    data: {
      name,
      description,
      createdById: req.userId!,
      members: {
        create: [
          { userId: req.userId!, role: 'ADMIN' },
          ...memberIds
            .filter((id) => id !== req.userId)
            .map((id) => ({ userId: id, role: 'MEMBER' as const })),
        ],
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
    },
  });

  res.status(201).json({ group });
}

export async function getGroups(req: AuthRequest, res: Response): Promise<void> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: req.userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
      _count: { select: { expenses: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({ groups });
}

export async function getGroup(req: AuthRequest, res: Response): Promise<void> {
  const group = await prisma.group.findFirst({
    where: { id: req.params.id, members: { some: { userId: req.userId } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      },
      expenses: {
        include: {
          paidBy: { select: { id: true, name: true, avatarUrl: true } },
          shares: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!group) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  res.json({ group });
}

export async function addGroupMember(req: AuthRequest, res: Response): Promise<void> {
  const { id: groupId } = req.params;
  const { userId } = z.object({ userId: z.string() }).parse(req.body);

  const callerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });

  if (!callerMembership || callerMembership.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only admins can add members' });
    return;
  }

  const member = await prisma.groupMember.create({
    data: { groupId, userId, role: 'MEMBER' },
    include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
  });

  res.status(201).json({ member });
}

export async function removeGroupMember(req: AuthRequest, res: Response): Promise<void> {
  const { id: groupId, userId } = req.params;

  const callerMembership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });

  if (!callerMembership || (callerMembership.role !== 'ADMIN' && userId !== req.userId)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await prisma.groupMember.delete({
    where: { groupId_userId: { groupId, userId } },
  });

  res.json({ success: true });
}

export async function deleteGroup(req: AuthRequest, res: Response): Promise<void> {
  const { id: groupId } = req.params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });

  if (!membership || membership.role !== 'ADMIN') {
    res.status(403).json({ error: 'Only admins can delete a group' });
    return;
  }

  await prisma.group.delete({ where: { id: groupId } });

  res.json({ success: true });
}

export async function getGroupBalances(req: AuthRequest, res: Response): Promise<void> {
  const { id: groupId } = req.params;

  const membership = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: req.userId! } },
  });
  if (!membership) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  const expenses = await prisma.expense.findMany({
    where: { groupId },
    include: { shares: true },
  });

  // net[userId] = total paid - total owed across all expenses
  const net: Record<string, Decimal> = {};

  for (const expense of expenses) {
    const paidById = expense.paidById;
    if (!net[paidById]) net[paidById] = new Decimal(0);
    net[paidById] = net[paidById].plus(expense.amount);

    for (const share of expense.shares) {
      if (!net[share.userId]) net[share.userId] = new Decimal(0);
      net[share.userId] = net[share.userId].minus(share.amount);
    }
  }

  // Build pairwise balances: who owes whom
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
  });

  const balances = members.map((m) => ({
    user: m.user,
    net: (net[m.userId] ?? new Decimal(0)).toNumber(),
  }));

  res.json({ balances });
}
