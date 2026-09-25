const Review = require('./../models/reviewModel');
const Booking = require('./../models/bookingModel');
const catchasync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const socket = require('./../utils/socket');
const factory = require(`${__dirname}/handler-Methods-Req`);
//to get all reviews
exports.getAllReviews = catchasync(async (req, res) => {
  let filter = {};
  if (req.params.tourId) filter = { tour: req.params.tourId };

  const reviews = await Review.find(filter);
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews,
    },
  });
});

exports.deleteReview = factory.deleteHandler(
  Review,
  204,
  'review deleted successfuly',
);

// users can only review tours they have booked (and only once, unique index)
exports.checkBooked = catchasync(async (req, res, next) => {
  const booked = await Booking.exists({
    tour: req.body.tour,
    user: req.user._id,
  });
  if (!booked) {
    return next(
      new AppError('You can only review tours that you have booked', 403),
    );
  }
  const reviewed = await Review.exists({
    tour: req.body.tour,
    user: req.user._id,
  });
  if (reviewed) {
    return next(new AppError('You have already reviewed this tour', 400));
  }
  next();
});

// to post new review (and push it live to everybody on the tour page)
exports.createReview = catchasync(async (req, res, next) => {
  const review = await Review.create({
    review: req.body.review,
    rating: req.body.rating,
    tour: req.body.tour,
    user: req.body.user,
  });
  socket.emitToTour(String(review.tour), 'review:new', {
    review: review.review,
    rating: review.rating,
    user: { name: req.user.name, photo: req.user.photo },
  });
  res.status(201).json({
    status: 'success',
    requestTime: req.requestTime,
    message: 'review created successfuly',
    data: {
      data: review,
    },
  });
});
//to update review
exports.updateReview = factory.updateHandler(
  Review,
  200,
  'review updated successfuly',
);
//toget review
exports.getReview = factory.getOneHandler(Review, 200, 'enjoy with reviews');

// reviews of the logged in user
exports.getMyReviews = catchasync(async (req, res) => {
  const reviews = await Review.find({ user: req.user._id }).populate({
    path: 'tour',
    select: 'name slug imageCover',
  });
  res.status(200).json({
    status: 'success',
    results: reviews.length,
    data: {
      reviews,
    },
  });
});

// regular users can only update or delete their own reviews
exports.checkReviewOwner = catchasync(async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Source data not found', 404));
  // user is populated with "-_id" so compare with the raw id
  const ownerId = review.populated('user') || review.user;
  if (String(ownerId) !== String(req.user._id)) {
    return next(new AppError('You can only modify your own reviews', 403));
  }
  // do not allow moving a review to another tour/user
  delete req.body.user;
  delete req.body.tour;
  next();
});
