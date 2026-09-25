const Review = require('./../models/reviewModel');
const catchasync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
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
  'tour deleted successfuly',
);
// to post new tour
exports.createReview = factory.createHandler(
  Review,
  201,
  'review created successfuly',
);
//to update tour
exports.updateReview = factory.updateHandler(
  Review,
  200,
  'tour updated successfuly',
);
//toget review
exports.getReview = factory.getOneHandler(Review, 200, 'enjoy with reviews');
//  function to update  ratingn avg when user delete or update review
 
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
