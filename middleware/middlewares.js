//function middleware to check user&tour ids
exports.checkId = (req, res, next) => {
  if (!req.body.tour) req.body.tour = req.params.tourId;
  // a review always belongs to the logged in user
  req.body.user = req.user._id;
  next();
};
