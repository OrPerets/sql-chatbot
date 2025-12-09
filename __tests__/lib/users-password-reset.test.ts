import { UsersService } from '@/lib/users'
import { connectToDatabase, COLLECTIONS } from '@/lib/database'
import crypto from 'crypto'

// Mock the database module
jest.mock('@/lib/database', () => ({
  connectToDatabase: jest.fn(),
  executeWithRetry: jest.fn(),
  COLLECTIONS: {
    USERS: 'users',
    PASSWORD_RESET_TOKENS: 'password_reset_tokens'
  }
}))

const mockConnectToDatabase = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>
const mockExecuteWithRetry = require('@/lib/database').executeWithRetry as jest.MockedFunction<any>

describe('UsersService - Password Reset', () => {
  let usersService: UsersService
  let mockDb: any

  beforeEach(() => {
    mockDb = {
      collection: jest.fn().mockReturnThis(),
      findOne: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
      countDocuments: jest.fn()
    }

    mockConnectToDatabase.mockResolvedValue({ client: {} as any, db: mockDb })
    mockExecuteWithRetry.mockImplementation(async (operation) => {
      return await operation(mockDb)
    })

    usersService = new UsersService(mockDb)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('createPasswordResetToken', () => {
    it('should create a password reset token for existing user', async () => {
      const email = 'test@example.com'
      const mockUser = { _id: '1', email, name: 'Test User' }
      const mockToken = 'generated-token-123'

      // Mock crypto.randomBytes
      const originalRandomBytes = crypto.randomBytes
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from(mockToken, 'hex'))

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser),
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'token-id' })
      })

      const result = await usersService.createPasswordResetToken(email)

      expect(result).toBe(mockToken)
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.USERS)
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.PASSWORD_RESET_TOKENS)
      expect(mockDb.collection().findOne).toHaveBeenCalledWith({ email })
      expect(mockDb.collection().insertOne).toHaveBeenCalledWith({
        email,
        token: mockToken,
        expiresAt: expect.any(Date),
        used: false,
        createdAt: expect.any(Date)
      })

      // Restore original crypto.randomBytes
      crypto.randomBytes = originalRandomBytes
    })

    it('should throw error if user does not exist', async () => {
      const email = 'nonexistent@example.com'

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })

      await expect(usersService.createPasswordResetToken(email)).rejects.toThrow('User not found')
      expect(mockDb.collection().findOne).toHaveBeenCalledWith({ email })
    })

    it('should generate token with 1 hour expiration', async () => {
      const email = 'test@example.com'
      const mockUser = { _id: '1', email, name: 'Test User' }
      const mockToken = 'generated-token-123'

      const originalRandomBytes = crypto.randomBytes
      crypto.randomBytes = jest.fn().mockReturnValue(Buffer.from(mockToken, 'hex'))

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockUser),
        insertOne: jest.fn().mockResolvedValue({ insertedId: 'token-id' })
      })

      const beforeTime = new Date()
      await usersService.createPasswordResetToken(email)
      const afterTime = new Date()

      const insertCall = mockDb.collection().insertOne.mock.calls[0][0]
      const expiresAt = insertCall.expiresAt

      expect(expiresAt.getTime()).toBeGreaterThan(beforeTime.getTime() + 59 * 60 * 1000) // At least 59 minutes
      expect(expiresAt.getTime()).toBeLessThan(afterTime.getTime() + 61 * 60 * 1000) // At most 61 minutes

      crypto.randomBytes = originalRandomBytes
    })
  })

  describe('validatePasswordResetToken', () => {
    it('should return valid for unused, non-expired token', async () => {
      const token = 'valid-token-123'
      const email = 'test@example.com'
      const mockTokenDoc = {
        _id: 'token-id',
        email,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
        used: false,
        createdAt: new Date()
      }

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockTokenDoc)
      })

      const result = await usersService.validatePasswordResetToken(token)

      expect(result).toEqual({
        valid: true,
        email
      })
      expect(mockDb.collection).toHaveBeenCalledWith(COLLECTIONS.PASSWORD_RESET_TOKENS)
      expect(mockDb.collection().findOne).toHaveBeenCalledWith({ token })
    })

    it('should return invalid for non-existent token', async () => {
      const token = 'nonexistent-token'

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })

      const result = await usersService.validatePasswordResetToken(token)

      expect(result).toEqual({
        valid: false,
        error: 'Invalid token'
      })
    })

    it('should return invalid for used token', async () => {
      const token = 'used-token-123'
      const mockTokenDoc = {
        _id: 'token-id',
        email: 'test@example.com',
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        used: true,
        createdAt: new Date()
      }

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockTokenDoc)
      })

      const result = await usersService.validatePasswordResetToken(token)

      expect(result).toEqual({
        valid: false,
        error: 'Token already used'
      })
    })

    it('should return invalid for expired token', async () => {
      const token = 'expired-token-123'
      const mockTokenDoc = {
        _id: 'token-id',
        email: 'test@example.com',
        token,
        expiresAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        used: false,
        createdAt: new Date()
      }

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockTokenDoc)
      })

      const result = await usersService.validatePasswordResetToken(token)

      expect(result).toEqual({
        valid: false,
        error: 'Token expired'
      })
    })
  })

  describe('applyPasswordResetToken', () => {
    it('should successfully reset password with valid token', async () => {
      const token = 'valid-token-123'
      const newPassword = 'newpassword123'
      const email = 'test@example.com'
      const mockTokenDoc = {
        _id: 'token-id',
        email,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        used: false,
        createdAt: new Date()
      }

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockTokenDoc),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 })
      })

      // Mock updatePassword method
      const updatePasswordSpy = jest.spyOn(usersService, 'updatePassword').mockResolvedValue({ modifiedCount: 1 })

      const result = await usersService.applyPasswordResetToken(token, newPassword)

      expect(result).toEqual({
        success: true
      })
      expect(updatePasswordSpy).toHaveBeenCalledWith(email, newPassword)
      expect(mockDb.collection().updateOne).toHaveBeenCalledWith(
        { token },
        { $set: { used: true } }
      )

      updatePasswordSpy.mockRestore()
    })

    it('should return error for invalid token', async () => {
      const token = 'invalid-token'
      const newPassword = 'newpassword123'

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null)
      })

      const result = await usersService.applyPasswordResetToken(token, newPassword)

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired token'
      })
    })

    it('should return error if password update fails', async () => {
      const token = 'valid-token-123'
      const newPassword = 'newpassword123'
      const email = 'test@example.com'
      const mockTokenDoc = {
        _id: 'token-id',
        email,
        token,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        used: false,
        createdAt: new Date()
      }

      mockDb.collection.mockReturnValue({
        findOne: jest.fn().mockResolvedValue(mockTokenDoc)
      })

      // Mock updatePassword to return 0 modified count
      const updatePasswordSpy = jest.spyOn(usersService, 'updatePassword').mockResolvedValue({ modifiedCount: 0 })

      const result = await usersService.applyPasswordResetToken(token, newPassword)

      expect(result).toEqual({
        success: false,
        error: 'Failed to update password'
      })

      updatePasswordSpy.mockRestore()
    })
  })

  describe('checkPasswordResetRateLimit', () => {
    it('should allow request when under rate limit', async () => {
      const email = 'test@example.com'

      mockDb.collection.mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(2) // Under limit of 3
      })

      const result = await usersService.checkPasswordResetRateLimit(email)

      expect(result).toEqual({
        allowed: true
      })
      expect(mockDb.collection().countDocuments).toHaveBeenCalledWith({
        email,
        createdAt: { $gte: expect.any(Date) }
      })
    })

    it('should deny request when at rate limit', async () => {
      const email = 'test@example.com'
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const oldestToken = {
        _id: 'oldest-token',
        email,
        createdAt: oneHourAgo
      }

      mockDb.collection.mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(3), // At limit
        findOne: jest.fn().mockResolvedValue(oldestToken)
      })

      const result = await usersService.checkPasswordResetRateLimit(email)

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBeGreaterThan(0)
      expect(result.remainingTime).toBeLessThanOrEqual(60) // Should be less than 60 minutes
    })

    it('should deny request when over rate limit', async () => {
      const email = 'test@example.com'

      mockDb.collection.mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(5) // Over limit
      })

      const result = await usersService.checkPasswordResetRateLimit(email)

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBeDefined()
    })

    it('should calculate remaining time correctly', async () => {
      const email = 'test@example.com'
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
      const oldestToken = {
        _id: 'oldest-token',
        email,
        createdAt: thirtyMinutesAgo
      }

      mockDb.collection.mockReturnValue({
        countDocuments: jest.fn().mockResolvedValue(3),
        findOne: jest.fn().mockResolvedValue(oldestToken)
      })

      const result = await usersService.checkPasswordResetRateLimit(email)

      expect(result.allowed).toBe(false)
      expect(result.remainingTime).toBeGreaterThan(25) // Should be around 30 minutes
      expect(result.remainingTime).toBeLessThan(35)
    })
  })
})
