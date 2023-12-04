const fs = require('fs');
require('dotenv').config({
  path: './config.env',
});
const mongoose = require('mongoose');
const Tour = require(`./../../models/tourModel`);
const User = require(`./../../models/userModel`);
const Review = require(`./../../models/reviewModel`);

// Connect to DB
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

const tours = fs.readFileSync(`${__dirname}/tours.json`, 'utf-8');
const users = fs.readFileSync(`${__dirname}/users.json`, 'utf-8');
const reviews = fs.readFileSync(`${__dirname}/reviews.json`, 'utf-8');
// import data into db
const importData = async () => {
  try {
    await User.create(JSON.parse(users), {
      validateBeforeSave: false,
    });
    await Tour.create(JSON.parse(tours), {
      validateBeforeSave: false,
    });
    await Review.create(JSON.parse(reviews), {
      validateBeforeSave: false,
    });
    console.log('Data successfully loaded!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
const deleteData = async () => {
  try {
    await User.deleteMany();
    await Tour.deleteMany();
    await Review.deleteMany();
    console.log('Data successfully deleted!');
  } catch (err) {
    console.log(err);
  }
  process.exit();
};
if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}
console.log(process.argv);
