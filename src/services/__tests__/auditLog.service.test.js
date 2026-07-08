process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

import { jest } from '@jest/globals';

const mockCreate = jest.fn();
const mockFindMany = jest.fn();

jest.unstable_mockModule('../../config/prisma.js', () => ({
  default: { auditLog: { create: mockCreate, findMany: mockFindMany } },
}));

const { recordAuditLog, getAuditLog } = await import('../auditLog.service.js');

describe('auditLog.service (Sprint 2 Batch 4)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockFindMany.mockReset();
  });

  describe('recordAuditLog', () => {
    test('writes via the passed-in transaction client, not the module-level prisma singleton', async () => {
      const tx = { auditLog: { create: jest.fn() } };

      await recordAuditLog(tx, {
        actorId: 'admin-1',
        actorRole: 'admin',
        action: 'USER_BANNED',
        entityType: 'User',
        entityId: 'user-1',
        metadata: { isBanned: true },
      });

      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: 'admin-1',
          actorRole: 'admin',
          action: 'USER_BANNED',
          entityType: 'User',
          entityId: 'user-1',
          metadata: { isBanned: true },
        },
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    test('defaults actorId/actorRole to null and metadata to undefined when omitted', async () => {
      const tx = { auditLog: { create: jest.fn() } };

      await recordAuditLog(tx, { action: 'SYSTEM_EVENT', entityType: 'BusinessProfile', entityId: 'biz-1' });

      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: {
          actorId: null,
          actorRole: null,
          action: 'SYSTEM_EVENT',
          entityType: 'BusinessProfile',
          entityId: 'biz-1',
          metadata: undefined,
        },
      });
    });
  });

  describe('getAuditLog', () => {
    test('returns recent entries, newest first, with no filters', async () => {
      mockFindMany.mockResolvedValue([{ id: 'log-1' }]);

      const result = await getAuditLog();

      expect(result).toEqual([{ id: 'log-1' }]);
      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' }, take: 100 })
      );
    });

    test('filters by entityType/entityId/actorId when provided', async () => {
      mockFindMany.mockResolvedValue([]);

      await getAuditLog({ entityType: 'BusinessProfile', entityId: 'biz-1', actorId: 'admin-1' });

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { entityType: 'BusinessProfile', entityId: 'biz-1', actorId: 'admin-1' } })
      );
    });
  });
});
