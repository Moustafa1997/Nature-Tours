const express = require('express');
const morgan = require('morgan');
const AppError = require('./utils/appError');
const globalHandlerError = require('./controller/errorController');
const app = express();
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRouter');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const path = require('path');
const cookieParser = require('cookie-parser');
const compression = require('compression');

// trust the first proxy (Railway / Heroku etc.) so req.ip, req.protocol and rate limiting work
app.set('trust proxy', 1);
app.disable('x-powered-by');

//setting up pugs
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

//to open static files in browser
app.use(express.static(`${__dirname}/public`));

//set security HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://js.stripe.com', 'https://api.mapbox.com'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://api.mapbox.com',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://*.mapbox.com'],
        connectSrc: [
          "'self'",
          'https://*.mapbox.com',
          'https://events.mapbox.com',
          'https://api.stripe.com',
        ],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

// for parsing application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
// use rate limit to prevent several requet many time
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many request from this IP, please try again in an hour!',
});
app.use('/api', limiter);

// stricter limit for authentication endpoints (brute force protection)
const authLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many attempts from this IP, please try again later!',
});
app.use(
  [
    '/api/v1/users/login',
    '/api/v1/users/SignUp',
    '/api/v1/users/forgetPassword',
    '/api/v1/users/resetPassword',
  ],
  authLimiter,
);

// for parsing application/json from body (limit body size)
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

//data sanitazation against no sql query in jection suca  in login "email": {"$gt":""}
app.use(mongoSanitize());
// data sanitize against xss  -html code  write in body
app.use(xss());
// prevent params pollution  such write to sort params it will take one
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsAverage',
      'ratingsQuantity',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  }),
);

//to compress response send to client
app.use(compression());

// routes

//middle ware to get request time
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});
app.use('/', viewRouter);

app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// middle ware to avoid any wrong linl we use all for all htt method not use get the post
app.all('*', (req, res, next) => {
  // const err = new Error(`Cannot find ${req.originalUrl} on the server`);
  const message = `Cannot find ${req.originalUrl} on the server`; //

  next(new AppError(message, 404));
});
app.use(globalHandlerError);

module.exports = app;
