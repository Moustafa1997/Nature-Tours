const express = require('express');
const viewController = require('../controller/viewsController');
const viewer = express.Router();
const authController = require('../controller/authController');
const BookingController = require('../controller/bookingController');

// every page knows who is logged in
viewer.use(authController.isLoggendIn);

// here we render our pug files cin views
viewer.get(
  '/',
  BookingController.createBookingCheckout,
  viewController.getOverview,
);
viewer.get('/tour/:slug', viewController.getTour);
viewer.get('/login', viewController.loginPage);
viewer.get('/signup', viewController.signupPage);
viewer.get('/forgot-password', viewController.forgotPasswordPage);
viewer.get('/reset-password/:token', viewController.resetPasswordPage);
viewer.get('/confirm-email/:token', viewController.confirmEmailPage);

// pages for logged in users
viewer.get('/me', authController.requireLogin, viewController.getAccount);
viewer.get('/my-tours', authController.requireLogin, viewController.getMyTours);
viewer.get(
  '/my-favorites',
  authController.requireLogin,
  viewController.getMyFavorites,
);
viewer.get(
  '/my-reviews',
  authController.requireLogin,
  viewController.getMyReviews,
);
viewer.post(
  '/submit-user-data',
  authController.requireLogin,
  viewController.updateAccount,
);

module.exports = viewer;
