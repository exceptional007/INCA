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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/marketplace',
})
export class MarketplaceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MarketplaceGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: MarketplaceChatService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const rawToken =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization
          ? client.handshake.headers.authorization.replace('Bearer ', '')
          : null);

      if (!rawToken) {
        this.logger.warn(`Marketplace Socket connection rejected: No token provided (${client.id})`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(rawToken);
      const userId = payload.sub || payload.id;
      if (!userId) {
        client.disconnect();
        return;
      }

      client.data.userId = userId;
      client.data.user = payload;

      // Join individual user room for real-time notifications
      client.join(`user_${userId}`);
      this.logger.log(`Marketplace Socket connected: User ${userId} (${client.id})`);
    } catch (err: any) {
      this.logger.warn(`Marketplace Socket authentication error: ${err.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Marketplace Socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) {
      return { success: false, error: 'Unauthorized or missing conversation ID' };
    }

    const isMember = await this.chatService.isUserConversationParticipant(
      userId,
      data.conversationId,
    );

    if (!isMember) {
      this.logger.warn(
        `Unauthorized room join attempt: User ${userId} tried to join conv_${data.conversationId}`,
      );
      return { success: false, error: 'You are not an authorized participant of this conversation' };
    }

    const room = `conv_${data.conversationId}`;
    client.join(room);
    this.logger.log(`Client ${client.id} (user ${userId}) authorized and joined room ${room}`);
    return { success: true, room };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (data?.conversationId) {
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
    const userId = client.data?.userId;
    if (!userId || !data?.conversationId) return;

    const isMember = await this.chatService.isUserConversationParticipant(
      userId,
      data.conversationId,
    );
    if (!isMember) return;

    client.to(`conv_${data.conversationId}`).emit('userTyping', {
      userId,
      conversationId: data.conversationId,
      isTyping: data.isTyping,
    });
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const userId = client.data.userId;
    if (!userId) {
      return { error: 'Unauthorized' };
    }

    try {
      const { message, recipientId } = await this.chatService.saveMessage(userId, dto);

      // Broadcast to room
      this.server.to(`conv_${dto.conversationId}`).emit('newMessage', message);

      // Notify recipient's user room
      this.server.to(`user_${recipientId}`).emit('unreadNotification', {
        type: 'MARKETPLACE_MESSAGE',
        conversationId: dto.conversationId,
        message,
      });

      return { success: true, message };
    } catch (err: any) {
      return { error: err.message };
    }
  }

  // Public helper to emit offer and transaction updates to relevant clients
  notifyUser(userId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`user_${userId}`).emit(event, payload);
    }
  }

  notifyConversation(conversationId: string, event: string, payload: any) {
    if (this.server) {
      this.server.to(`conv_${conversationId}`).emit(event, payload);
    }
  }
}

