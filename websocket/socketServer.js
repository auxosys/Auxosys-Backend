/**
 * socketServer.js
 *
 * Attaches Socket.IO to your existing HTTP server for real-time mailbox events.
 */

const { Server } = require('socket.io');

function createSocketServer(httpServer, { corsOrigin } = {}) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin || '*', credentials: true },
  });

  io.on('connection', (socket) => {
    socket.on('watch-mailbox', (mailboxId) => {
      for (const room of socket.rooms) {
        if (room.startsWith('mailbox:') && room !== `mailbox:${mailboxId}`) {
          socket.leave(room);
        }
      }
      socket.join(`mailbox:${mailboxId}`);
    });

    socket.on('unwatch-mailbox', (mailboxId) => {
      socket.leave(`mailbox:${mailboxId}`);
    });
  });

  return io;
}

module.exports = { createSocketServer };
