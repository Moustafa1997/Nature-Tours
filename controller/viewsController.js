const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Review = require('../models/reviewModel');
const catchAsync = require('./../utils/catchAsync');
const { confirmEmailToken, baseUrl } = require('./authController');

exports.getOverview = catchAsync(async (req, res, next) => {
  //1) get tour data from collection
  const tours = await Tour.find();

  //2) render template using tour data
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
      select: 'review rating user',
    })
    .populate({
      path: 'guides',
      select: 'name photo role',
    });

  if (!tour) {
    return next(new AppError('There is no tour with that name', 404));
  }

  //2) what the logged in user can do on this tour
  const { user } = res.locals;
  let booked = false;
  let canReview = false;
  let isFavorite = false;
  if (user) {
    booked = Boolean(await Booking.exists({ tour: tour._id, user: user._id }));
    const reviewed = Boolean(
      await Review.exists({ tour: tour._id, user: user._id }),
    );
    canReview = booked && !reviewed && user.role === 'user';
    isFavorite = (user.favoriteTours || []).some(
      (id) => String(id) === String(tour._id),
    );
  }

  res.status(200).render('tour', {
    title: tour.name,
    tour,
    booked,
    canReview,
    isFavorite,
    mapboxToken: process.env.MAPBOX_TOKEN,
  });
});
//login
exports.loginPage = (req, res) => {
  res.status(200).render('login', {
    title: 'Log into your account',
  });
};
//sign up
exports.signupPage = (req, res) => {
  res.status(200).render('signup', {
    title: 'create a new account',
  });
};
// forgot password
exports.forgotPasswordPage = (req, res) => {
  res.status(200).render('forgotPassword', {
    title: 'Forgot your password',
  });
};
// reset password (link from the email)
exports.resetPasswordPage = (req, res) => {
  res.status(200).render('resetPassword', {
    title: 'Reset your password',
    token: req.params.token,
  });
};
// confirm email (link from the email)
exports.confirmEmailPage = catchAsync(async (req, res) => {
  const user = await confirmEmailToken(req.params.token, baseUrl(req));
  res.status(user ? 200 : 400).render('message', {
    title: user ? 'Email confirmed' : 'Invalid link',
    heading: user ? 'Your email is confirmed 🎉' : 'This link is invalid',
    msg: user
      ? 'Thank you! You can now book your next adventure.'
      : 'The confirmation link is invalid or has expired. Log in and request a new one from your account page.',
    link: user ? '/' : '/me',
    linkText: user ? 'Explore tours' : 'Go to my account',
  });
});
//get account
exports.getAccount = (req, res) => {
  res.status(200).render('account', {
    title: 'Your account',
    active: 'settings',
  });
};
//update account
exports.updateAccount = catchAsync(async (req, res, next) => {
  //1) update the user
  const updatedUser = await User.findByIdAndUpdate(
    req.user.id,
    { name: req.body.name, email: req.body.email },
    {
      new: true,
      runValidators: true,
    },
  );
  //2) render the user account page
  res.status(200).render('account', {
    title: 'Your account',
    active: 'settings',
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
    title: 'My bookings',
    heading: 'My bookings',
    empty: "You haven't booked any tours yet.",
    tours,
  });
});

// favorite tours of the user
exports.getMyFavorites = catchAsync(async (req, res, next) => {
  const tours = await Tour.find({
    _id: { $in: req.user.favoriteTours || [] },
  });
  res.status(200).render('overview', {
    title: 'My favorite tours',
    heading: 'My favorite tours',
    empty:
      'No favorites yet. Open a tour you have booked and add it to your favorites.',
    tours,
  });
});

// reviews written by the user
exports.getMyReviews = catchAsync(async (req, res, next) => {
  const reviews = await Review.find({ user: req.user._id }).populate({
    path: 'tour',
    select: 'name slug',
  });
  res.status(200).render('myReviews', {
    title: 'My reviews',
    active: 'reviews',
    reviews,
  });
});
