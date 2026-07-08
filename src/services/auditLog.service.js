import prisma from '../config/prisma.js';

/**
 * Records one audit entry. Callers pass the transaction client (tx) they're
 * already using for the primary action, so the log write commits atomically
 * with it — unlike vendor notifications, a lost audit entry silently defeats
 * the point of the feature, so this is never fire-and-forget.
 */
export const recordAuditLog = (tx, { actorId, actorRole, action, entityType, entityId, metadata }) => {
  return tx.auditLog.create({
    data: {
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      action,
      entityType,
      entityId,
      metadata: metadata ?? undefined,
    },
  });
};

/** Admin-facing: recent audit entries, optionally filtered by entity or actor. */
export const getAuditLog = async ({ entityType, entityId, actorId, take = 100 } = {}) => {
  return prisma.auditLog.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(actorId ? { actorId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
  });
};
