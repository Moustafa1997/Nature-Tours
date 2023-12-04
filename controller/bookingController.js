const { errors } = require('stripe');
const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require(`${__dirname}/handler-Methods-Req`);
const AppError = require('./../utils/appError');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  //1) get the currently booked tour
  const tour = await Tour.findById(req.params.tourID);
  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }

  //2) create checkout session
  const session = await stripe.checkout.sessions.create({
    //info about session
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/?tour=${
      req.params.tourID
    }&user=${req.user.id}&price=${tour.price}`,
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourID,

    //payment
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${tour.name} Tour`,
            description: tour.summary,
            images: [`https://www.natours.dev/img/tours/${tour.imageCover}`],
          },

          currency: 'usd',
          unit_amount: tour.price * 100,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
  });
  //3) create session as response
  res.status(200).json({
    status: 'success',
    session,
  });
});

//store booking to db
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  const { tour, user, price } = req.query;
  if (!tour && !user && !price) return next();
  await Booking.create({
    tour,
    user,
    price,
  });
  res.redirect('/');
});

//crud operations for booking
exports.deleteBooking = factory.deleteHandler(
  Booking,
  204,
  'booking deleted successfuly',
);
// to create booking
exports.createBooking = factory.createHandler(
  Booking,
  201,
  'bookinh created successfuly',
);
//to update booking
exports.updateBooking = factory.updateHandler(
  Booking,
  200,
  'booking updated successfully',
);
//
exports.getAllBookings = factory.getAllHandler(
  Booking,
  200,
  'all bookings fetched successfuly',
);
//
exports.getBooking = factory.getOneHandler(
  Booking,
  200,
  'single booking fetched successfuly',
);
