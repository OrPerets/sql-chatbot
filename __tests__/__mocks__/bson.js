// Mock for BSON library
const ObjectId = jest.fn((id) => ({ $oid: id }));
const Binary = jest.fn();
const Code = jest.fn();
const DBRef = jest.fn();
const Decimal128 = jest.fn();
const Double = jest.fn();
const Int32 = jest.fn();
const Long = jest.fn();
const MaxKey = jest.fn();
const MinKey = jest.fn();
const Timestamp = jest.fn();
const UUID = jest.fn();

const bson = {
  ObjectId,
  Binary,
  Code,
  DBRef,
  Decimal128,
  Double,
  Int32,
  Long,
  MaxKey,
  MinKey,
  Timestamp,
  UUID,
  calculateObjectSize: jest.fn(),
  deserialize: jest.fn(),
  serialize: jest.fn()
};

module.exports = {
  BSON: bson,
  BSONError: Error,
  BSONOffsetError: Error,
  BSONRegExp: RegExp,
  BSONRuntimeError: Error,
  BSONSymbol: Symbol,
  BSONType: Object,
  BSONValue: Object,
  BSONVersionError: Error,
  Binary,
  Code,
  DBRef,
  Decimal128,
  Double,
  EJSON: {},
  Int32,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
  UUID,
  calculateObjectSize: jest.fn(),
  deserialize: jest.fn(),
  deserializeStream: jest.fn(),
  onDemand: jest.fn(),
  serialize: jest.fn(),
  serializeWithBufferAndIndex: jest.fn(),
  setInternalBufferSize: jest.fn(),
  bson
};
