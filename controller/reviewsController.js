const Review = require('./../models/reviewModel');
const catchasync = require('./../utils/catchAsync');
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
 