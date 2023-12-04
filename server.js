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
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);
const db = process.env.DATABASE_LOCAL;
mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then((con) => {
    // console.log(con.connections);
    console.log('DB connection successful');
  });

const port = process.env.PORT || 8000;
//console.log(process.env)
const server = app.listen(port, () => {
  console.log(`Server listening on port : ${port}`);
});
// handle error from mongo if we are not connect to db
mongoose.connection.on('error', (err) => {
  console.log(err.message);
  server.close(() => {
    process.exit(1);
  });
  //process.exit(1);
});
// or by process
/*  process.on('unhandledRejection', (err) => {
   console.log('UNHANDLED REJECTION! 💥 Shutting down...');
   console.log(err.name, err.message);
   process.exit(1);
  
}) */
