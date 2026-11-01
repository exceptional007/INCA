import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { MarketplaceChatService } from './marketplace-chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/marketplace',
})
export class MarketplaceGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketplaceGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: MarketplaceChatService,
    private readonly identity: JwtStrategy,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? client.handshake.headers.authorization.replace('Bearer ', '')
          : null);

      if (!rawToken) {
        this.logger.warn(
          `Marketplace Socket connection rejected: No token provided (${client.id})`,
        );
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(rawToken);
      const user = await this.identity.validate(
        { originalUrl: '/api/v1/marketplace/socket' },
        payload,
      );
      const userId = user.id;

      client.data.userId = userId;
      client.data.user = payload;
      client.data.accessToken = rawToken;

      // Join individual user room for real-time notifications
      client.join(`user_${userId}`);
      this.logger.log(
        `Marketplace Socket connected: User ${userId} (${client.id})`,
      );
    } catch (err: any) {
      this.logger.warn(
        `Marketplace Socket authentication error: ${err.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Marketplace Socket disconnected: ${client.id}`);
  }

  private async authenticated(client: any): Promise<string | null> {
    try {
      const payload = this.jwtService.verify(client.data?.accessToken);
      const user = await this.identity.validate(
        { originalUrl: '/api/v1/marketplace/socket' },
        payload,
      );
      if (user.id !== client.data.userId) throw new Error('Invalid identity');
      return user.id;
    } catch {
      client.disconnect(true);
      return null;
    }
  }

  private async emitAuthorized(
    room: string | null,
    event: string,
    payload: any,
    exceptId?: string,
  ) {
    if (!this.server) return;
    const sockets = await (
      room ? this.server.in(room) : this.server
    ).fetchSockets();
    await Promise.all(
      sockets.map(async (client) => {
        if (client.id !== exceptId && (await this.authenticated(client)))
          client.emit(event, payload);
      }),
    );
  }

  private deliver(
    room: string | null,
    event: string,
    payload: any,
    exceptId?: string,
  ) {
    void this.emitAuthorized(room, event, payload, exceptId).catch(() =>
      this.logger.warn('Marketplace delivery failed.'),
    );
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = await this.authenticated(client);
    if (!userId || !data?.conversationId) {
      return {
        success: false,
        error: 'Unauthorized or missing conversation ID',
      };
    }

    const isMember = await this.chatService.isUserConversationParticipant(
      userId,
      data.conversationId,
    );

    if (!isMember) {
      this.logger.warn(
        `Unauthorized room join attempt: User ${userId} tried to join conv_${data.conversationId}`,
      );
      return {
        success: false,
        error: 'You are not an authorized participant of this conversation',
      };
    }

    const room = `conv_${data.conversationId}`;
    client.join(room);
    this.logger.log(
      `Client ${client.id} (user ${userId}) authorized and joined room ${room}`,
    );
    return { success: true, room };
  }

  @SubscribeMessage('leaveConversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if ((await this.authenticated(client)) && data?.conversationId) {
      const room = `conv_${data.conversationId}`;
      client.leave(room);
      return { success: true };
    }
  }

  @SubscribeMessage('typingIndicator')
  async handleTypingIndicator(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; isTyping: boolean },
  ) {
    const userId = await this.authenticated(client);
    if (!userId || !data?.conversationId) return;

    const isMember = await this.chatService.isUserConversationParticipant(
      userId,
      data.conversationId,
    );
    if (!isMember) return;

    this.deliver(
      `conv_${data.conversationId}`,
      'userTyping',
      {
        userId,
        conversationId: data.conversationId,
        isTyping: data.isTyping,
      },
      client.id,
    );
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = await this.authenticated(client);
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const { message, recipientId } = await this.chatService.saveMessage(
        userId,
        dto,
      );

      // Broadcast to room
      this.notifyConversation(message.conversationId, 'newMessage', message);

      // Notify recipient's user room
      this.notifyUser(recipientId, 'unreadNotification', {
        type: 'MARKETPLACE_MESSAGE',
        conversationId: message.conversationId,
        message,
      });

      return { success: true, message };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  // Public helper to emit offer and transaction updates to relevant clients
  notifyUser(userId: string, event: string, payload: any) {
    this.deliver(`user_${userId}`, event, payload);
  }

  notifyConversation(conversationId: string, event: string, payload: any) {
    this.deliver(`conv_${conversationId}`, event, payload);
  }

  broadcast(event: string, payload: any) {
    this.deliver(null, event, payload);
  }
}
