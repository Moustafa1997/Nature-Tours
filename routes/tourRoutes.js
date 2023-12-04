const express = require('express');
const tour = express.Router();
const tourController = require('../controller/toursController');
const authController = require('../controller/authController');
///const reviewController = require('../controller/reviewsController');
const reviewrouter = require(`${__dirname}/reviewRoutes`);
//middle ware to return id param middleware
//tour.param('id', tourController.checkId);
tour
  .route('/monthly-plan/:year')
  .get(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide', 'guide'),
    tourController.getMonthlyPlan,
  );
//get all tours

tour.route('/tour-stats').get(tourController.getTourStats);
//to get top5 tours
tour
  .route('/top-5-cheap')
  .get(tourController.aliasTopTours, tourController.getAllTours);

tour.route('/').get(tourController.getAllTours).post(
  authController.protect,
  authController.restrictTo('admin', 'lead-guide'),

  tourController.createTour,
);

tour
  .route('/:id')
  .get(tourController.getTour)
  .patch(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.uploadTourImages,
    tourController.resizeTourImages,
    tourController.updateTour,
  )
  .delete(
    authController.protect,
    authController.restrictTo('admin', 'lead-guide'),
    tourController.deleteTour,
  );
// to set reviews for  tour nested routs
tour.use('/:tourId/reviews', reviewrouter);

// to get all tours around me
tour
  .route('/tours-within/:distance/center/:latlng/unit/:unit')
  .get(tourController.getToursWithin);

// route for tour-distance
tour
  .route('/distances/:latlng/unit/:unit')
  .get(tourController.calculateDistance);

module.exports = tour;
