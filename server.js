const mongoose = require('mongoose');
require('dotenv').config({
  path: './config.env',
});
//handle uncaughtException
process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});
const app = require('./app');
const socket = require('./utils/socket');
//to connect with db
const DB = (process.env.DATABASE || process.env.DATABASE_LOCAL || '').replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD || '',
);
if (!DB) {
  console.log('DATABASE environment variable is missing! 💥 Shutting down...');
  process.exit(1);
}
// keep retrying instead of crashing, so a paused / unreachable database
// does not put the service into a crash loop
const connectDB = () => {
  mongoose
    .connect(DB, { serverSelectionTimeoutMS: 10000 })
    .then(() => console.log('DB connection successful'))
    .catch((err) => {
      console.log('DB connection failed 💥', err.name, err.message);
      console.log(
        'Check DATABASE / DATABASE_PASSWORD and that MongoDB Atlas Network Access allows 0.0.0.0/0. Retrying in 10s...',
      );
      setTimeout(connectDB, 10000);
    });
};
connectDB();

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`Server listening on port : ${port}`);
});
// real time features (live reviews / viewers)
socket.init(server);
// mongoose reconnects by itself after the first connection, just log errors
mongoose.connection.on('error', (err) => {
  console.log('DB error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.log('DB disconnected');
});
// handle any promise rejection that was not caught (e.g. db connection failed)
process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
// graceful shutdown when the platform (railway/docker) stops the container
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    mongoose.connection.close(false).finally(() => process.exit(0));
  });
});
