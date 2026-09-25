const bookingController = require('../controller/bookingController');
const express = require('express');
const booking = express.Router();
const authController = require('../controller/authController');

// all booking routes need a logged in user
booking.use(authController.protect);

// routes to check out session
booking.get('/checkout-session/:tourID', bookingController.getCheckoutSession);

// everything below is only for admins and lead guides
booking.use(authController.restrictTo('admin', 'lead-guide'));
// route for creating a new booking
booking.post('/newBooking', bookingController.createBooking);
// route for getting all the bookings
booking.get('/userBookings', bookingController.getAllBookings);
// route for deleting a booking
booking.delete('/:id', bookingController.deleteBooking);
// get specific bookibg
booking.get('/:id', bookingController.getBooking);
// to update bookig
booking.patch('/update/:id', bookingController.updateBooking);

module.exports = booking;
