// Mock for MongoDB driver
const mockCollection = {
  find: jest.fn().mockReturnThis(),
  findOne: jest.fn(),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  toArray: jest.fn().mockResolvedValue([]),
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis()
};

const mockDb = {
  collection: jest.fn().mockReturnValue(mockCollection),
  admin: jest.fn().mockReturnValue({
    ping: jest.fn().mockResolvedValue({ ok: 1 })
  })
};

const mockClient = {
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn().mockResolvedValue()
};

const MongoClient = {
  connect: jest.fn().mockResolvedValue(mockClient)
};

module.exports = {
  MongoClient,
  ObjectId: jest.fn((id) => ({ $oid: id })),
  Db: mockDb,
  Collection: mockCollection
};
