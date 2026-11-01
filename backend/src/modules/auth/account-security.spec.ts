import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockImplementation(async (value) => 'hashed-' + value),
}));

describe('Account status and initial credential protection', () => {
  const repo = {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    findDepartmentById: jest.fn(),
    findRoleByCode: jest.fn(),
    createUser: jest.fn(),
    createAdminUser: jest.fn(),
    createAuditLog: jest.fn(),
  };
  const jwt = { signAsync: jest.fn() };
  let service: AuthService;
  const user = {
    id: 'user',
    email: 'user@example.test',
    password: 'hash',
    isActive: true,
    role: { code: 'ADMIN', isActive: true },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    repo.findUserByEmail.mockResolvedValue(user);
    repo.findUserById.mockResolvedValue(user);
    repo.findDepartmentById.mockResolvedValue({
      id: 'department',
      isActive: true,
    });
    repo.findRoleByCode.mockResolvedValue({ id: 'role' });
    repo.createUser.mockResolvedValue({ ...user, password: 'secret-hash' });
    repo.createAdminUser.mockResolvedValue({
      ...user,
      password: 'secret-hash',
    });
    repo.createAuditLog.mockResolvedValue({});
    jwt.signAsync.mockResolvedValue('token');
    service = new AuthService(
      repo as any,
      jwt as any,
      {
        issue: async () => ({
          accessToken: 'token',
          user: { id: user.id, email: user.email, role: user.role },
        }),
      } as any,
    );
  });
  it.each([
    { ...user, isActive: false },
    { ...user, role: { ...user.role, isActive: false } },
  ])(
    'does not issue tokens for inactive accounts or roles',
    async (inactive) => {
      repo.findUserByEmail.mockResolvedValue(inactive);
      await expect(
        service.login({ email: user.email, password: 'input' }),
      ).rejects.toMatchObject({ status: 401 });
      expect(jwt.signAsync).not.toHaveBeenCalled();
    },
  );
  it('still logs in an active account without exposing its hash', async () => {
    const result = await service.login({
      email: user.email,
      password: 'input',
    });
    expect(result.data.accessToken).toBe('token');
    expect(result.data.user.password).toBeUndefined();
  });
  function strategy() {
    return new JwtStrategy(
      {
        getOrThrow: () => 'test-only-jwt-secret-at-least-32-characters',
      } as any,
      repo as any,
      {
        authSession: {
          findUnique: async () => ({
            id: 'session',
            userId: 'user',
            authVersion: undefined,
            expiresAt: new Date(Date.now() + 60000),
          }),
        },
      } as any,
    );
  }
  it.each([
    null,
    { ...user, isActive: false },
    { ...user, role: { ...user.role, isActive: false } },
  ])('rejects deleted or inactive JWT users/roles', async (current) => {
    repo.findUserById.mockResolvedValue(current);
    await expect(
      strategy().validate(
        { originalUrl: '/api/v1/auth/me' },
        { sub: 'user', role: 'SUPER_ADMIN' },
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
  it('uses current role and email instead of stale JWT claims', async () => {
    await expect(
      strategy().validate(
        { originalUrl: '/api/v1/auth/me' },
        {
          sub: 'user',
          sid: 'session',
          purpose: 'access',
          email: 'old',
          role: 'SUPER_ADMIN',
        },
      ),
    ).resolves.toMatchObject({ id: 'user', email: user.email, role: 'ADMIN' });
  });
  it('rejects a JWT with no user identity', async () => {
    await expect(
      strategy().validate(
        { originalUrl: '/api/v1/auth/me' },
        { role: 'ADMIN' },
      ),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(repo.findUserById).not.toHaveBeenCalled();
  });
  it.each(['admin', 'coordinator'])(
    'generates unique initial credentials for %s accounts',
    async (kind) => {
      repo.findUserByEmail.mockResolvedValue(null);
      const create = () =>
        kind === 'admin'
          ? service.createAdmin('SUPER_ADMIN', {
              name: 'Admin',
              email: 'new@example.test',
              departmentId: 'department',
            })
          : service.createCoordinator('ADMIN', { email: 'new@example.test' });
      const first = await create(),
        second = await create();
      expect(first.initialPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
      expect(first.initialPassword).not.toBe(second.initialPassword);
      expect(first.password).toBeUndefined();
      expect(bcrypt.hash).toHaveBeenCalledWith(first.initialPassword, 12);
    },
  );
  it('does not return an explicit initial password in the response', async () => {
    repo.findUserByEmail.mockResolvedValue(null);
    const result = await service.createCoordinator('ADMIN', {
      email: 'new@example.test',
      password: 'chosen-private-password',
    });
    expect(result.initialPassword).toBeUndefined();
    expect(result.password).toBeUndefined();
  });
});
