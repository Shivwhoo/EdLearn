import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import db from './lib/db';
import { logger } from './lib/logger';

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(o => o.trim().replace(/\/+$/, '')),
      credentials: true,
    }
  });

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const pubClient = new Redis(redisUrl);
  const subClient = pubClient.duplicate();
  
  io.adapter(createAdapter(pubClient, subClient));

  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as { id: string, email: string };
      (socket as any).user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    logger.info(`Socket connected: ${socket.id} (User: ${user.id})`);

    socket.on('join_room', (roomId: string) => {
      socket.join(roomId);
      socket.to(roomId).emit('user_joined', { userId: user.id, email: user.email });
      logger.info(`User ${user.id} joined room ${roomId}`);
    });

    socket.on('leave_room', (roomId: string) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user_left', { userId: user.id });
      logger.info(`User ${user.id} left room ${roomId}`);
    });

    socket.on('draw', (data: { roomId: string, drawData: any }) => {
      socket.to(data.roomId).emit('draw', data.drawData);
    });

    socket.on('clear_whiteboard', (roomId: string) => {
      socket.to(roomId).emit('clear_whiteboard');
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}
