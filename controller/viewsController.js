const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('./../utils/catchAsync');

exports.getOverview = catchAsync(async (req, res, next) => {
  //1) get tour data from collection
  const tours = await Tour.find();

  //2) build template

  //3) render template using tour data

  res.status(200).render('overview', {
    title: 'All tours',
    tours,
  });
});

exports.getTour = catchAsync(async (req, res, next) => {
  //1) get the data, for the requested tour (including reviews and guides)
  const tour = await Tour.findOne({ slug: req.params.slug })
    .populate({
      path: 'reviews',
      fields: 'review rating user',
    })
    .populate({
      path: 'guides',
      fields: 'name email',
    });

  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }

  res
    .status(200)

    .render('tour', {
      title: tour.name,
      tour,
    });
});
//login
exports.loginPage = (req, res) => {
  res.status(200).render('login', {
    title: 'Log into your account',
  });
};
//get account
exports.getAccount = catchAsync(async (req, res, next) => {
  //1) get the user from the session
  const user = req.user;
  if (!user) {
    return next(new AppError('You must be logged in to view this page', 404));
  }
  res.status(200).render('account', {
    title: 'Your account',
    user,
  });
});
//update account
exports.updateAccount = catchAsync(async (req, res, next) => {
  //1) get the user from the session
  const user = req.user;
  if (!user) {
    return next(new AppError('You must be logged in to view this page', 404));
  }
  //2) update the user
  const updatedUser = await User.findByIdAndUpdate(
    user.id,
    { name: req.body.name, email: req.body.email, photo: req.file.photo },
    {
      new: true,
      runValidators: true,
    },
  );
  //3) save the user
  await updatedUser.save();
  //4) update the session
  //req.session.user = updatedUser;
  //5) redirect to the user account page
  res.status(200).render('account', {
    title: 'Your account',
    user: updatedUser,
  });
});

// find all tour that user has booken
exports.getMyTours = catchAsync(async (req, res, next) => {
  //1) retrieve all booking
  const booking = await Booking.find({
    user: req.user._id,
  });

  //2I) search in db for all tours belong to this user
  const tourIDs = booking.map((el) => {
    return el.tour;
  });
  const tours = await Tour.find({ _id: { $in: tourIDs } });

  //3) render reponse
  res.status(200).render('overview', {
    title: 'Booking history',
    tours,
  });
});
