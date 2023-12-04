const AppError = require('./../utils/appError');
const Email = require('./../utils/email');
const catchAsync = require('./../utils/catchAsync');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { token } = require('morgan');
const multer = require('multer');
const sharp = require('sharp');

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
const upload = multer({ storage: storage, fileFilter: fileFilter });

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

// to return token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// create function to send token
const sendTokenRespone = (user, code, res, message) => {
  const token = signToken(user._id);
  const CookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === 'production') CookieOptions.secure = true;
  res.cookie('jwt', token, CookieOptions);
  // remove password from output
  user.password = undefined;
  res.status(code).json({
    status: 'success',
    token: token,
    message: message,
    data: {
      user,
    },
  });
};

// to sign up
exports.SignUp = catchAsync(async (req, res, next) => {
  const newUser = await User.create(req.body);
  const url = `${req.protocol}://${req.get('host')}/me`;
  console.log(url);
  await new Email(newUser, url).sendWelcome();

  // Create token
  const message = 'SignUp successfully';
  sendTokenRespone(newUser, 201, res, message);
});

// login using jwt

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  // check if the email and password exist in our database
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }
  // if everything is ok
  const message = 'Login successfully';
  sendTokenRespone(user, 200, res, message);
});

// to log out
exports.logout = (req, res) => {
  res.clearCookie('jwt');
  //clear header jwt token

  res.json({
    status: 'success',
    token: null,
    message: 'Logged Out Successfully',
    data: {},
  });
};

// protect our tours by jwt verify
exports.protect = catchAsync(async (req, res, next) => {
  // get token and check of it is there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401),
    );
  }
  // Verification token
  const decoded = await jwt.verify(token, process.env.JWT_SECRET);

  // check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        'The user belonging to this token does no longer exist.',
        401,
      ),
    );
  }

  // check if user change password after the token was issued
  if (currentUser.chanePasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! Please log in again.', 401),
    );
  }
  // taken payload
  req.user = currentUser;
  res.locals.user = currentUser;
  //console.log(req.user);

  next();
});

// only for rendered pages no error
exports.isLoggendIn = async (req, res, next) => {
  try {
    if (req.cookies.jwt) {
      // Verification token
      const decoded = await jwt.verify(req.cookies.jwt, process.env.JWT_SECRET);

      // check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // check if user change password after the token was issued
      if (currentUser.chanePasswordAfter(decoded.iat)) {
        return next();
      }
      // there is a logged in user
      res.locals.user = currentUser;
      //console.log(req.user);

      return next();
    }
  } catch (error) {
    return next();
  }
  next();
};

//funtion to give apermission for users to access tours
// wrap funtion return a function
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log(req.user);
      return next(
        new AppError('You do not have permission to perform this action', 403),
      );
    }
    next();
  };
};
// forget password
exports.forgetpassword = catchAsync(async (req, res, next) => {
  // check if user is exists
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('there is no user with this email address', 404));
  }
  //generate token
  const resetToken = user.createPasswordResetToken();
  console.log('fk' + resetToken);
  await user.save({
    validateBeforeSave: false,
  });

  try {
    // send email
    const resetURL = `${req.protocol}://${req.get(
      'host',
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({
      validateBeforeSave: false,
    });
    console.log(err);
    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500,
    );
  }
  res.status(200).json({
    status: 'success',
    message: 'Token sent to email!',
  });
  next();
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

  // log in user after changing password
  const message = `your password has been changed ,,, you are now logged in`;
  sendTokenRespone(user, 200, res, message);

  next();
});

// update password
exports.updatePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');
  // compare input pass with  old  one
  if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
    return next(new AppError('Your current password is wrong', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  const message = 'your password has been changed';
  sendTokenRespone(user, 200, res, message);

  next();
});

// to update me
exports.updateMe = catchAsync(async (req, res, next) => {
  const filter = filterObj(req.body, 'name', 'email');

  if (req.file) {
    filter.photo = req.file.filename;
  }

  const user = await User.findByIdAndUpdate(req.user._id, filter, {
    new: true,
    runValidators: true,
  }).select('-__v');
  res.status(200).json({
    status: 'success',
    message: 'your profile has been updated',

    data: {
      user,
    },
  });
});

// to delete me
exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });
  res.status(204).json({
    status: 'success',
    message: 'your account has been deleted',
  });
});
