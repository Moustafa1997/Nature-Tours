const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require(`${__dirname}/handler-Methods-Req`);
const AppError = require('./../utils/appError');
const Stripe = require('stripe');

// create the client lazily so a missing key does not crash the whole server
let stripeClient;
const stripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new AppError('Payments are not configured on this server', 500);
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
};

const baseUrl = (req) =>
  process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`;

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  //1) get the currently booked tour
  const tour = await Tour.findById(req.params.tourID);
  if (!tour) {
    return next(new AppError('No tour found with that ID', 404));
  }

  //2) create checkout session
  const session = await stripe().checkout.sessions.create({
    //info about session
    payment_method_types: ['card'],
    // the booking is created from the verified stripe session, never from query params
    success_url: `${baseUrl(req)}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl(req)}/tour/${tour.slug}`,
    customer_email: req.user.email,
    client_reference_id: req.params.tourID,
    metadata: { tourId: String(tour._id), userId: String(req.user._id) },

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

          unit_amount: Math.round(tour.price * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
  });
  //3) create session as response
  res.status(200).json({
    status: 'success',
    session: { id: session.id, url: session.url },
  });
});

//store booking to db
exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  const sessionId = req.query.session_id;
  if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
    return next();
  }
  // verify the payment with stripe instead of trusting the url
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== 'paid' || !session.metadata) {
    return res.redirect('/');
  }
  const { tourId, userId } = session.metadata;
  const exists = await Booking.exists({ tour: tourId, user: userId });
  if (!exists) {
    await Booking.create({
      tour: tourId,
      user: userId,
      price: session.amount_total / 100,
    });
  }
  res.redirect('/my-tours');
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
