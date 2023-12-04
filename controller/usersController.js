const User = require('../models/userModel');
const factory = require(`${__dirname}/handler-Methods-Req`);
//to get all user in js
exports.getAllUsers = factory.getAllHandler(User, 200, 'ohh great users');
//to get one user in js
exports.getSingleUser = factory.getOneHandler(User, 200, 'iam a user');
//to delete user
exports.deleteUser = factory.deleteHandler(User, 204, 'user deleted');
// to update user
exports.updateUser = factory.updateHandler(User, 200, 'user updated');
