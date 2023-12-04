const bookingController = require('../controller/bookingController');
const express = require('express');
const booking = express.Router();
const authController = require('../controller/authController');

// routes to check out session
booking.get(
  '/checkout-session/:tourID',
  authController.protect,
  bookingController.getCheckoutSession,
);
// route for creating a new booking
booking.use(authController.restrictTo('admin', 'lead-guide'));
booking.post(
  '/newBooking',
  authController.protect,
  bookingController.createBooking,
);
// route for getting all the bookings of a user
booking.get(
  '/userBookings',
  authController.protect,
  bookingController.getAllBookings,
);
// route for deleting a booking
booking.delete('/:id', authController.protect, bookingController.deleteBooking);
// get specific bookibg
booking.get('/:id', authController.protect, bookingController.getBooking);
// to update bookig
booking.patch(
  '/update/:id',
  authController.protect,
  bookingController.updateBooking,
);

module.exports = booking;
