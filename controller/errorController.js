const AppError = require('../utils/appError');
// send error in case development

const handelCastError = (err) => {
  return new AppError(`Invalid ${err.path} : ${err.value}`, 400);
};
const handleDuplicateError = (err) => {
  err = new AppError(
    `Duplicate ${Object.keys(err.keyValue)} : ${JSON.stringify(err.keyValue)}`,
    400,
  );
  return err;
};
const handleValidationError = (err) => {
  let errors = Object.values(err.errors)
    .map((val) => val.message)
    .join(',');
  const message = `invalid input data: ${errors}`;
  err = new AppError(message, 400);
  return err;
};

// handee jwt invild signature
const handleInvalidSignature = (err) => {
  err = new AppError('invalid token', 401);
  return err;
};
// handel expired token error
const handleExpiredToken = (err) => {
  err = new AppError('your token has been expired please log  in again ', 401);
  return err;
};

const sendErrorDev = (err, req, res) => {
  //api
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  console.error('ERROR', err);
  // rendered website
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong',
    msg: err.message,
  });
};
//send err in case production yo user
const sendErrorProd = (err, req, res) => {
  //api
  if (req.originalUrl.startsWith('/api')) {
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    }
    console.error('ERROR', err);
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong',
    });
  }
  //rendered website

  if (err.isOperational) {
    return res.status(err.statusCode).render('error', {
      title: 'Something went wrong',
      msg: err.message,
    });
  }
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong',
    msg: 'please try again later',
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    //let error = { ...err };

    sendErrorDev(err, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    //handle cast to object id error
    if (err.name === 'CastError') err = handelCastError(err);

    if (err.code === 11000) err = handleDuplicateError(err);

    if (err.name === 'ValidationError') err = handleValidationError(err);
    if (err.name === 'JsonWebTokenError') err = handleInvalidSignature(err);
    if (err.name === 'TokenExpiredError') err = handleExpiredToken(err);

    sendErrorProd(err, req, res);
  }
};
