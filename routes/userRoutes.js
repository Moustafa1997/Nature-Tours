const express = require('express');
const user = express.Router();
const userController = require('../controller/usersController');
const authController = require('../controller/authController');
// for parsing multipart/form-data
user.route('/SignUp').post(authController.SignUp);
user.route('/login').post(authController.login);
user.route('/logout').get(authController.logout).post(authController.logout);
user.route('/refreshToken').post(authController.refreshToken);
user.route('/forgetPassword').post(authController.forgetpassword);
user.route('/resetPassword/:token').patch(authController.resetPassword);
user.route('/confirmEmail/:token').get(authController.confirmEmail);

//middle  ware to protect
user.use(authController.protect);

user.route('/resendConfirmation').post(authController.resendConfirmation);
user.route('/updatePassword').patch(authController.updatePassword);
user
  .route('/updateMe')
  .patch(
    authController.uploadUserphoto,
    authController.resizeUserphoto,
    authController.updateMe,
  );
// delet me
user.route('/deleteMe').delete(authController.deleteMe);
// to get me

user.get('/me', authController.getMe, userController.getSingleUser);

// two-factor authentication
user.post('/2fa/setup', authController.setupTwoFactor);
user.post('/2fa/enable', authController.enableTwoFactor);
user.post('/2fa/disable', authController.disableTwoFactor);

// favorite tours
user.get('/favorites', userController.getFavorites);
user
  .route('/favorites/:tourId')
  .post(authController.restrictTo('user'), userController.addFavorite)
  .delete(authController.restrictTo('user'), userController.removeFavorite);

// middle ware before next routes
user.use(authController.restrictTo('admin'));
user
  .route('/:id')
  .get(userController.getSingleUser)
  .delete(userController.deleteUser)
  .patch(userController.updateUser);
// to get all users
user.get('/', userController.getAllUsers);

module.exports = user;
