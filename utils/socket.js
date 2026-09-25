// real time features with socket.io
// - live reviews: new reviews show up on the tour page without reloading
// - live viewers: "N people are looking at this tour right now"
const { Server } = require('socket.io');
const mongoose = require('mongoose');

let io;

const room = (tourId) => `tour:${tourId}`;

const emitViewers = async (tourId) => {
  const sockets = await io.in(room(tourId)).fetchSockets();
  io.to(room(tourId)).emit('tour:viewers', { tourId, count: sockets.length });
};

exports.init = (server) => {
  io = new Server(server, {
    // same origin only
    cors: { origin: process.env.APP_URL || false },
  });

  io.on('connection', (socket) => {
    socket.on('tour:join', async (tourId) => {
      if (!mongoose.isValidObjectId(tourId)) return;
      // a socket watches one tour at a time
      [...socket.rooms]
        .filter((r) => r.startsWith('tour:'))
        .forEach((r) => socket.leave(r));
      socket.data.tourId = String(tourId);
      await socket.join(room(tourId));
      await emitViewers(tourId);
    });

    socket.on('disconnect', async () => {
      if (socket.data.tourId) await emitViewers(socket.data.tourId);
    });
  });

  return io;
};

// send an event to everybody looking at a tour (no-op when sockets are off, e.g. tests)
exports.emitToTour = (tourId, event, payload) => {
  if (!io) return;
  io.to(room(tourId)).emit(event, payload);
};

exports.close = () => (io ? io.close() : undefined);
