/**
 * @jest-environment node
 */

const mockUpdateOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockFindOne = jest.fn();
const mockToArray = jest.fn();
const mockFind = jest.fn(() => ({ toArray: mockToArray }));
const mockCollection = jest.fn(() => ({
  updateOne: mockUpdateOne,
  findOneAndUpdate: mockFindOneAndUpdate,
  findOne: mockFindOne,
  find: mockFind,
}));
const mockDb = { collection: mockCollection };

jest.mock('@/lib/database', () => ({
  COLLECTIONS: {
    COINS: 'Coins',
    COINS_STATUS: 'CoinsStatus',
  },
  executeWithRetry: (callback: (db: typeof mockDb) => unknown) => callback(mockDb),
  connectToDatabase: jest.fn(async () => ({ db: mockDb })),
}));

import { CoinsService } from '@/lib/coins';

describe('CoinsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0, upsertedCount: 1 });
  });

  it('bulk-updates each selected user with upsert and a zero balance floor', async () => {
    const service = new CoinsService(mockDb as any);

    const result = await service.updateCoinsBalance(
      ['Student@Example.com', 'student@example.com', 'other@example.com'],
      -5,
    );

    expect(mockUpdateOne).toHaveBeenCalledTimes(2);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { user: 'student@example.com' },
      expect.arrayContaining([
        expect.objectContaining({
          $set: expect.objectContaining({
            user: 'student@example.com',
            coins: expect.objectContaining({
              $max: expect.any(Array),
            }),
          }),
        }),
      ]),
      { upsert: true },
    );
    expect(result.upsertedCount).toBe(2);
  });

});
