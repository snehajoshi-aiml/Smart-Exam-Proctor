import { io } from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      this.socket.on('connect', () => {
        console.log('🔌 Connected to Socket.IO Server:', this.socket.id);
        this.socket.emit('join_admin');
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('🔌 Disconnected from Socket.IO Server:', reason);
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(eventName, callback) {
    if (this.socket) {
      this.socket.on(eventName, callback);
    }
  }

  off(eventName, callback) {
    if (this.socket) {
      this.socket.off(eventName, callback);
    }
  }

  emit(eventName, data) {
    if (this.socket) {
      this.socket.emit(eventName, data);
    }
  }

  subscribeStudentVideo(studentId) {
    if (this.socket) {
      this.socket.emit('subscribe_student', studentId);
    }
  }
}

const socketServiceInstance = new SocketService();
export default socketServiceInstance;
