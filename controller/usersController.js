const User = require('../models/userModel');
const Booking = require('../models/bookingModel');
const Tour = require('../models/tourModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const factory = require(`${__dirname}/handler-Methods-Req`);
//to get all user in js
exports.getAllUsers = factory.getAllHandler(User, 200, 'ohh great users');
//to get one user in js
exports.getSingleUser = factory.getOneHandler(User, 200, 'iam a user');
//to delete user
exports.deleteUser = factory.deleteHandler(User, 204, 'user deleted');
// to update user
exports.updateUser = factory.updateHandler(User, 200, 'user updated');

/* favorite tours */

exports.getFavorites = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate({
    path: 'favoriteTours',
    select: 'name slug imageCover price duration ratingsAverage',
  });
  res.status(200).json({
    status: 'success',
    results: user.favoriteTours.length,
    data: {
      tours: user.favoriteTours,
    },
  });
});

// only booked tours can become favorites, and only once
exports.addFavorite = catchAsync(async (req, res, next) => {
  const { tourId } = req.params;
  const tour = await Tour.findById(tourId);
  if (!tour) return next(new AppError('No tour found with that ID', 404));

  const booked = await Booking.exists({ tour: tourId, user: req.user._id });
  if (!booked) {
    return next(
      new AppError('You can only add tours you have booked to favorites', 403),
    );
  }
  const user = await User.findById(req.user._id);
  if (user.favoriteTours.some((id) => String(id) === String(tourId))) {
    return next(new AppError('This tour is already in your favorites', 400));
  }
  await User.updateOne(
    { _id: req.user._id },
    { $addToSet: { favoriteTours: tour._id } },
  );
  res.status(200).json({
    status: 'success',
    message: 'Tour added to your favorites',
  });
});

exports.removeFavorite = catchAsync(async (req, res, next) => {
  const { tourId } = req.params;
  const user = await User.findById(req.user._id);
  if (!user.favoriteTours.some((id) => String(id) === String(tourId))) {
    return next(new AppError('This tour is not in your favorites', 404));
  }
  await User.updateOne(
    { _id: req.user._id },
    { $pull: { favoriteTours: tourId } },
  );
  res.status(200).json({
    status: 'success',
    message: 'Tour removed from your favorites',
  });
});
