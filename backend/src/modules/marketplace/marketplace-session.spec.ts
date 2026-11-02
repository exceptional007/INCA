import { MarketplaceGateway } from './marketplace.gateway';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

describe('Marketplace session revocation', () => {
  const jwt = new JwtService({
    secret: 'test-only-marketplace-session-secret-32-characters',
  });
  const user = {
    id: 'user',
    email: 'demo@bit.ac.in',
    isActive: true,
    authVersion: 0,
    mustChangePassword: false,
    role: { code: 'STUDENT', isActive: true },
  };
  let session: any, account: any;
  let gateway: MarketplaceGateway;
  const chat = {
    isUserConversationParticipant: jest.fn(),
    saveMessage: jest.fn(),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    account = structuredClone(user);
    session = {
      id: 'session',
      userId: 'user',
      authVersion: 0,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    };
    const strategy = new JwtStrategy(
      {
        getOrThrow: () => 'test-only-marketplace-session-secret-32-characters',
      } as any,
      { findUserById: async () => account } as any,
      { authSession: { findUnique: async () => session } } as any,
    );
    gateway = new MarketplaceGateway(jwt, chat as any, strategy);
    chat.isUserConversationParticipant.mockResolvedValue(true);
    chat.saveMessage.mockResolvedValue({
      message: { id: 'message' },
      recipientId: 'recipient',
    });
  });
  const socket = (claims: object = {}) =>
    ({
      id: 'socket',
      handshake: {
        auth: {
          token: jwt.sign({
            sub: 'user',
            sid: 'session',
            purpose: 'access',
            ...claims,
          }),
        },
      },
      data: {},
      join: jest.fn(),
      leave: jest.fn(),
      disconnect: jest.fn(),
      emit: jest.fn(),
    }) as any;
  it.each([
    { purpose: 'password-change' },
    { sid: undefined },
    { purpose: undefined },
    { exp: 1 },
  ])('rejects restricted, legacy and expired tokens %p', async (claims) => {
    const client = socket(claims);
    await gateway.handleConnection(client);
    expect(client.disconnect).toHaveBeenCalled();
    expect(client.join).not.toHaveBeenCalled();
  });
  it('blocks sends and room joins immediately after revocation', async () => {
    const client = socket();
    await gateway.handleConnection(client);
    expect(client.join).toHaveBeenCalledWith('user_user');
    session.revokedAt = new Date();
    expect(
      await gateway.handleJoinConversation(client, {
        conversationId: 'conversation',
      }),
    ).toMatchObject({ success: false });
    await gateway.handleSendMessage(client, {
      conversationId: 'conversation',
      content: 'message',
    } as any);
    expect(chat.saveMessage).not.toHaveBeenCalled();
    expect(chat.isUserConversationParticipant).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });
  it.each(['inactive', 'version', 'mandatory'])(
    'blocks existing sockets after account change: %s',
    async (kind) => {
      const client = socket();
      await gateway.handleConnection(client);
      if (kind === 'inactive') account.isActive = false;
      if (kind === 'version') account.authVersion++;
      if (kind === 'mandatory') account.mustChangePassword = true;
      await gateway.handleTypingIndicator(client, {
        conversationId: 'conversation',
        isTyping: true,
      });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      expect(chat.isUserConversationParticipant).not.toHaveBeenCalled();
    },
  );
  it('filters revoked recipients before outgoing messages', async () => {
    const valid = socket(),
      revoked = socket();
    revoked.id = 'revoked-socket';
    await gateway.handleConnection(valid);
    await gateway.handleConnection(revoked);
    revoked.data.accessToken = jwt.sign({
      sub: 'user',
      sid: 'session',
      purpose: 'access',
      exp: 1,
    });
    gateway.server = {
      in: () => ({ fetchSockets: async () => [valid, revoked] }),
    } as any;
    await (gateway as any).emitAuthorized('conv_conversation', 'newMessage', {
      id: 'safe',
    });
    expect(valid.emit).toHaveBeenCalledWith('newMessage', { id: 'safe' });
    expect(revoked.emit).not.toHaveBeenCalled();
    expect(revoked.disconnect).toHaveBeenCalledWith(true);
  });
});
