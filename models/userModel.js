const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { default: isEmail } = require('validator/lib/isEmail');
// user schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'tell us your name'],
    trim: true,
    maxlength: [40, 'A  name must have less or equal then 40 characters'],
    minlength: [5, 'A  name must have more or equal then 10 characters'],
  },
  email: {
    type: String,
    required: [true, 'please tell us your email'],
    unique: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: isEmail,
      message: 'please enter a valid email',
    },
    // validate: {
    //   validator: (v) => /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v),
    //   message: 'please enter a valid email',
    // },
    lowercase: true,
    maxlength: [60, 'an email must have less or equal then 40 characters'],
    minlength: [10, 'an email must have more or equal then 10 characters'],
  },
  role: {
    type: String,
    default: 'user',
    enum: ['user', 'guide', 'lead-guide', 'admin'],
  },
  active: {
    type: Boolean,
    default: true,
    select: false,
  },
  photo: {
    type: String,
    default: 'default.jpg',
  },

  password: {
    type: String,
    required: [true, 'A tour must have a password'],
    minlength: 8,
    select: false,
  },
  passwordConfirm: {
    type: String,
    //required: [true, 'confirm your password'],
    validate: {
      //this only works on save and create
      validator: function (el) {
        return el === this.password;
      },
      message: 'passwords must match',
    },
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now(),
    select: false,
  },
  passwordResetToken: String,
  passwordResetExpires: Date,

  active: {
    type: Boolean,
    default: true,
    // select: false,
  },
});
// pre middle ware to encrypt password
userSchema.pre('save', async function (next) {
  // this is the current document
  // if the password was not modified we don npt need to encrypt it
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // we write it  we don npt need it in database only for confirm
  this.passwordConfirm = undefined;
  next();
});

// pre middle ware to changepassowrd at when user update or reset password
userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// method to compare input passwoed with hashed password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// check if password change after ti=oken was issued
userSchema.methods.chanePasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    //  console.log(this.passwordChangedAt, JWTTimestamp);
    const changedTimestamp = this.passwordChangedAt.getTime() / 1000;
    //console.log(changedTimestamp);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};
// to generate  Token to reser password
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

// pre middle ware to prevent return inactive user
userSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;
