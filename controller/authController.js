const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const catchAsync = require('./../utils/catchAsync');
const totp = require('./../utils/totp');
const User = require('../models/userModel');
const RefreshToken = require('../models/refreshTokenModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');
const sharp = require('sharp');
const QRCode = require('qrcode');

// config multer storage   here we dont use file system but buffer so we can resize image
const storage = multer.memoryStorage();
//multer filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};
//multer middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.uploadUserphoto = upload.single('photo');
// middle ware to resize image
exports.resizeUserphoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  req.file.filename = `user-${req.user._id}-${Date.now()}.jpeg`;
  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/users/${req.file.filename}`);
  next();
});

// base url used in emails; prefer configured APP_URL to avoid host header injection
const baseUrl = (req) =>
  process.env.APP_URL
    ? process.env.APP_URL.replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`;
exports.baseUrl = baseUrl;

//filter object
const filterObj = (obj, ...arg) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (arg.includes(el)) {
      newObj[el] = obj[el];
    }
  });
  return newObj;
};

//to get me
exports.getMe = (req, res, next) => {
  req.params.id = req.user._id;

  next();
};

/* ------------------------------------------------------------------ */
/* tokens                                                              */
/* ------------------------------------------------------------------ */

// short lived access token (JWT) + long lived refresh token (random, stored hashed)
const accessTokenExpiresIn = () => process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const refreshTokenDays = () =>
  Number(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS) ||
  Number(process.env.JWT_COOKIE_EXPIRES_IN) ||
  30;

// to return token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: accessTokenExpiresIn(),
  });
};

// verify token and only accept the algorithm we sign with
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
};

const cookieOptions = (req) => ({
  expires: new Date(Date.now() + refreshTokenDays() * 24 * 60 * 60 * 1000),
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production' && req.secure,
});

const createRefreshToken = async (user, req) => {
  const token = crypto.randomBytes(40).toString('hex');
  await RefreshToken.create({
    user: user._id,
    tokenHash: RefreshToken.hash(token),
    expiresAt: new Date(Date.now() + refreshTokenDays() * 24 * 60 * 60 * 1000),
    userAgent: (req.get('user-agent') || '').slice(0, 200),
  });
  return token;
};

// revoke every session of a user (password change, account deleted ...)
const revokeAllSessions = (userId) => RefreshToken.deleteMany({ user: userId });
exports.revokeAllSessions = revokeAllSessions;

const setAuthCookies = (req, res, accessToken, refreshToken) => {
  res.cookie('jwt', accessToken, cookieOptions(req));
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, cookieOptions(req));
  }
};

// create function to send token
const sendTokenRespone = async (user, code, req, res, message) => {
  const token = signToken(user._id);
  const refreshToken = await createRefreshToken(user, req);
  setAuthCookies(req, res, token, refreshToken);
  // remove secrets from output
  user.password = undefined;
  user.twoFactorSecret = undefined;
  user.twoFactorLastStep = undefined;
  user.emailConfirmToken = undefined;
  user.emailConfirmExpires = undefined;
  user.passwordChangedAt = undefined;
  res.status(code).json({
    status: 'success',
    token: token,
    refreshToken,
    message: message,
    data: {
      user,
    },
  });
};

// find the user of a valid, not expired refresh token
const userFromRefreshToken = async (refreshToken) => {
  if (typeof refreshToken !== 'string' || !refreshToken) return {};
  const stored = await RefreshToken.findOne({
    tokenHash: RefreshToken.hash(refreshToken),
    expiresAt: { $gt: new Date() },
  });
  if (!stored) return {};
  const user = await User.findById(stored.user);
  return { stored, user };
};

// user of the current request from the access token, falling back to the
// refresh token cookie (browser sessions) when the access token expired
const authenticate = async (req, res) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      const currentUser = await User.findById(decoded.id).select(
        '+passwordChangedAt',
      );
      if (!currentUser) {
        throw new AppError(
          'The user belonging to this token does no longer exist.',
          401,
        );
      }
      // check if user change password after the token was issued
      if (currentUser.chanePasswordAfter(decoded.iat)) {
        throw new AppError(
          'User recently changed password! Please log in again.',
          401,
        );
      }
      return currentUser;
    } catch (err) {
      // only an expired access token can be renewed with the refresh cookie
      if (err.name !== 'TokenExpiredError' || !req.cookies.refreshToken) {
        throw err;
      }
    }
  }

  if (!req.cookies.refreshToken) return null;
  const { user } = await userFromRefreshToken(req.cookies.refreshToken);
  if (!user) return null;
  // new access token, the refresh token stays the same (rotation happens on
  // the explicit /refreshToken endpoint so parallel requests do not race)
  setAuthCookies(req, res, signToken(user._id));
  return user;
};

/* ------------------------------------------------------------------ */
/* sign up / email confirmation                                        */
/* ------------------------------------------------------------------ */

const sendConfirmationEmail = async (user, req) => {
  const confirmToken = user.createEmailConfirmToken();
  await user.save({ validateBeforeSave: false });
  const url = `${baseUrl(req)}/confirm-email/${confirmToken}`;
  await new Email(user, url).sendConfirmEmail();
};

// to sign up
exports.SignUp = catchAsync(async (req, res, next) => {
  // only allow whitelisted fields so nobody can sign up as admin (role, active...)
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    emailConfirmed: false,
  });
  await sendConfirmationEmail(newUser, req);

  // Create token
  const message =
    'SignUp successfully! Please check your email to confirm your address';
  await sendTokenRespone(newUser, 201, req, res, message);
});

// confirm email with the token sent by email
const confirmEmailToken = async (token, siteUrl) => {
  if (typeof token !== 'string') return null;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    emailConfirmToken: hashedToken,
    emailConfirmExpires: { $gt: Date.now() },
  });
  if (!user) return null;
  user.emailConfirmed = true;
  user.emailConfirmToken = undefined;
  user.emailConfirmExpires = undefined;
  await user.save({ validateBeforeSave: false });
  await new Email(user, `${siteUrl}/me`).sendWelcome();
  return user;
};
exports.confirmEmailToken = confirmEmailToken;

exports.confirmEmail = catchAsync(async (req, res, next) => {
  const user = await confirmEmailToken(req.params.token, baseUrl(req));
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  res.status(200).json({
    status: 'success',
    message: 'Your email has been confirmed',
  });
});

exports.resendConfirmation = catchAsync(async (req, res, next) => {
  if (req.user.isEmailConfirmed) {
    return next(new AppError('Your email is already confirmed', 400));
  }
  await sendConfirmationEmail(req.user, req);
  res.status(200).json({
    status: 'success',
    message: 'Confirmation email sent! Please check your inbox',
  });
});

// block actions (like booking) until the email is confirmed
exports.requireConfirmedEmail = (req, res, next) => {
  if (!req.user.isEmailConfirmed) {
    return next(
      new AppError(
        'Please confirm your email address first (check your inbox)',
        403,
      ),
    );
  }
  next();
};

/* ------------------------------------------------------------------ */
/* login / logout / refresh                                            */
/* ------------------------------------------------------------------ */

// login using jwt (+ two-factor code when enabled)
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, code } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    return next(new AppError('Please provide email and password', 400));
  }
  // check if the email and password exist in our database
  const user = await User.findOne({ email }).select(
    '+password +twoFactorSecret +twoFactorLastStep',
  );
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  if (user.twoFactorEnabled) {
    if (!code) {
      return res.status(401).json({
        status: 'fail',
        twoFactorRequired: true,
        message: 'Please enter the 6-digit code from your authenticator app',
      });
    }
    const step = totp.verifyToken(user.twoFactorSecret, code);
    // a code can only be used once
    if (step === null || step <= (user.twoFactorLastStep || 0)) {
      return next(new AppError('Invalid two-factor code', 401));
    }
    user.twoFactorLastStep = step;
    await user.save({ validateBeforeSave: false });
  }

  // if everything is ok
  const message = 'Login successfully';
  await sendTokenRespone(user, 200, req, res, message);
});

// new access token + rotated refresh token
exports.refreshToken = catchAsync(async (req, res, next) => {
  const token = (req.body && req.body.refreshToken) || req.cookies.refreshToken;
  const { stored, user } = await userFromRefreshToken(token);
  if (!stored || !user) {
    return next(
      new AppError('Invalid or expired refresh token. Please log in', 401),
    );
  }
  await stored.deleteOne();
  const message = 'Token refreshed';
  await sendTokenRespone(user, 200, req, res, message);
});

// to log out
exports.logout = catchAsync(async (req, res) => {
  const token = (req.body && req.body.refreshToken) || req.cookies.refreshToken;
  if (typeof token === 'string' && token) {
    await RefreshToken.deleteOne({ tokenHash: RefreshToken.hash(token) });
  }
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });

  res.json({
    status: 'success',
    token: null,
    message: 'Logged Out Successfully',
    data: {},
  });
});

// protect our tours by jwt verify
exports.protect = catchAsync(async (req, res, next) => {
  const currentUser = await authenticate(req, res);
  if (!currentUser) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }
  // taken payload
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// only for rendered pages no error
exports.isLoggendIn = async (req, res, next) => {
  try {
    const currentUser = await authenticate(req, res);
    if (currentUser) {
      // there is a logged in user
      req.user = currentUser;
      res.locals.user = currentUser;
    }
  } catch (error) {
    // not logged in
  }
  next();
};

// rendered pages that need a user redirect to the login page
exports.requireLogin = (req, res, next) => {
  if (!res.locals.user) return res.redirect('/login');
  next();
};

//funtion to give apermission for users to access tours
// wrap funtion return a function
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};

/* ------------------------------------------------------------------ */
/* passwords                                                           */
/* ------------------------------------------------------------------ */

// forget password
exports.forgetpassword = catchAsync(async (req, res, next) => {
  const genericResponse = {
    status: 'success',
    message: 'If that email exists, a reset token has been sent to it!',
  };
  if (typeof req.body.email !== 'string') {
    return next(new AppError('Please provide your email address', 400));
  }
  const user = await User.findOne({ email: req.body.email });
  // do not reveal whether an account exists (user enumeration)
  if (!user) {
    return res.status(200).json(genericResponse);
  }
  //generate token
  const resetToken = user.createPasswordResetToken();
  await user.save({
    validateBeforeSave: false,
  });

  try {
    // send email (link to the reset password page)
    const resetURL = `${baseUrl(req)}/reset-password/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({
      validateBeforeSave: false,
    });
    console.error(err);
    return next(
      new AppError('There was an error sending the email. Try again later!', 500),
    );
  }
  res.status(200).json(genericResponse);
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  // log out every other session
  await revokeAllSessions(user._id);

  // log in user after changing password
  const message = `your password has been changed ,,, you are now logged in`;
  await sendTokenRespone(user, 200, req, res, message);
});

// update password
exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');
  // compare input pass with  old  one
  if (
    typeof req.body.currentPassword !== 'string' ||
    !(await user.correctPassword(req.body.currentPassword, user.password))
  ) {
    return next(new AppError('Your current password is wrong', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // log out every other session
  await revokeAllSessions(user._id);
  const message = 'your password has been changed';
  await sendTokenRespone(user, 200, req, res, message);
});

/* ------------------------------------------------------------------ */
/* two-factor authentication                                           */
/* ------------------------------------------------------------------ */

// step 1: create a secret and return it (+ QR code) to add to an authenticator app
exports.setupTwoFactor = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  if (user.twoFactorEnabled) {
    return next(new AppError('Two-factor authentication is already on', 400));
  }
  const secret = totp.generateSecret();
  user.twoFactorSecret = secret;
  await user.save({ validateBeforeSave: false });

  const otpauthUrl = totp.otpauthURL(secret, user.email);
  const qrCode = await QRCode.toDataURL(otpauthUrl);
  res.status(200).json({
    status: 'success',
    message: 'Scan the QR code with your authenticator app, then confirm',
    data: { secret, otpauthUrl, qrCode },
  });
});

// step 2: confirm with a code from the app to switch it on
exports.enableTwoFactor = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+twoFactorSecret');
  if (user.twoFactorEnabled) {
    return next(new AppError('Two-factor authentication is already on', 400));
  }
  if (!user.twoFactorSecret) {
    return next(new AppError('Please set up two-factor first', 400));
  }
  const step = totp.verifyToken(user.twoFactorSecret, req.body.code);
  if (step === null) {
    return next(new AppError('Invalid two-factor code', 400));
  }
  user.twoFactorEnabled = true;
  user.twoFactorLastStep = step;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication enabled',
  });
});

// switch off: needs password and a current code
exports.disableTwoFactor = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select(
    '+password +twoFactorSecret',
  );
  if (!user.twoFactorEnabled) {
    return next(new AppError('Two-factor authentication is not on', 400));
  }
  if (
    typeof req.body.password !== 'string' ||
    !(await user.correctPassword(req.body.password, user.password)) ||
    totp.verifyToken(user.twoFactorSecret, req.body.code) === null
  ) {
    return next(new AppError('Wrong password or two-factor code', 400));
  }
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.twoFactorLastStep = undefined;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: 'success',
    message: 'Two-factor authentication disabled',
  });
});

/* ------------------------------------------------------------------ */
/* profile                                                             */
/* ------------------------------------------------------------------ */

// to update me
exports.updateMe = catchAsync(async (req, res, next) => {
  const filter = filterObj(req.body, 'name', 'email');

  if (req.file) {
    filter.photo = req.file.filename;
  }
  // a new email address has to be confirmed again
  const emailChanged =
    typeof filter.email === 'string' &&
    filter.email.trim().toLowerCase() !== req.user.email;
  if (emailChanged) filter.emailConfirmed = false;

  const user = await User.findByIdAndUpdate(req.user._id, filter, {
    new: true,
    runValidators: true,
  }).select('-__v');
  if (emailChanged) await sendConfirmationEmail(user, req);
  res.status(200).json({
    status: 'success',
    message: emailChanged
      ? 'your profile has been updated, please confirm your new email'
      : 'your profile has been updated',

    data: {
      user,
    },
  });
});

// to delete me
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });
  await revokeAllSessions(req.user._id);
  res.clearCookie('jwt', { httpOnly: true, sameSite: 'lax' });
  res.clearCookie('refreshToken', { httpOnly: true, sameSite: 'lax' });
  res.status(204).json({
    status: 'success',
    message: 'your account has been deleted',
  });
});
