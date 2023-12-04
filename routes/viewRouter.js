const express = require('express');
const viewController = require('../controller/viewsController');
const viewer = express.Router();
const authController = require('../controller/authController');
const BookingController = require('../controller/bookingController');

// here we render our pug files cin views
viewer.get('/me', authController.protect, viewController.getAccount);
viewer.get('/my-tours', authController.protect, viewController.getMyTours);
viewer.use(authController.isLoggendIn);
viewer.get(
  '/',
  BookingController.createBookingCheckout,
  viewController.getOverview,
);
viewer.get('/tour/:slug', viewController.getTour);
viewer.get('/login', viewController.loginPage);
viewer.post(
  '/submit-user-data',
  authController.protect,
  viewController.updateAccount,
);

//viewer.post('/login', viewController.checkUser);

module.exports = viewer;
