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
//to connect with db
const DB = (process.env.DATABASE || process.env.DATABASE_LOCAL || '').replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD || '',
);
if (!DB) {
  console.log('DATABASE environment variable is missing! 💥 Shutting down...');
  process.exit(1);
}
mongoose.connect(DB).then(() => {
  console.log('DB connection successful');
});

const port = process.env.PORT || 8000;
const server = app.listen(port, () => {
  console.log(`Server listening on port : ${port}`);
});
// handle error from mongo if we are not connect to db
mongoose.connection.on('error', (err) => {
  console.log(err.message);
  server.close(() => {
    process.exit(1);
  });
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
