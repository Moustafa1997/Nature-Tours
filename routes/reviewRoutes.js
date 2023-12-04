const reviewController = require('../controller/reviewsController');
const express = require('express');
const Review = express.Router({ mergeParams: true });
const authController = require('../controller/authController');
const middleware=require('../middleware/middlewares')
Review.use(authController.protect);
Review.route('/')
  .get(reviewController.getAllReviews)
  .post(
    authController.restrictTo('user'),
    middleware.checkId,
    reviewController.createReview,
  );

//delete route
Review.route('/:id')
  .delete(
    authController.restrictTo('user', 'admin'),
    reviewController.deleteReview,
  )
  .patch(
    authController.restrictTo('user', 'admin'),
    reviewController.updateReview,
  )
  .get(reviewController.getReview);

module.exports = Review;
