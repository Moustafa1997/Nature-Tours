const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const ApiFeatures = require('../utils/apiFeatures');
exports.deleteHandler = (model, stausCode, message) => {
  return catchAsync(async (req, res, next) => {
    const data = await model.findByIdAndDelete(req.params.id);
    if (!data) {
      return next(new AppError('Source data not found', 404));
    }
    res.status(stausCode).json({
      status: 'success',
      requestTime: req.requestTime,
      message,
      data: {
        data,
      },
    });
  });
};
//create handler
exports.createHandler = (model, stausCode, message) => {
  return catchAsync(async (req, res, next) => {
    const data = await model.create(req.body);
    res.status(stausCode).json({
      status: 'success',
      requestTime: req.requestTime,
      message: message,
      data: {
        data,
      },
    });
  });
};
//update handler
exports.updateHandler = (model, stausCode, message) => {
  return catchAsync(async (req, res, next) => {
    const data = await model.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!data) {
      return next(new AppError('Source data not found', 404));
    }
    res.status(stausCode).json({
      status: 'success',
      requestTime: req.requestTime,
      message: message,
      data: {
        data,
      },
    });
  });
};
//get one with populate
exports.getOneHandler = (model, stausCode, message, populate) => {
  return catchAsync(async (req, res, next) => {
    const data = await model.findById(req.params.id).populate(populate);
    if (!data) {
      return next(new AppError('Source data not found', 404));
    }
    res.status(stausCode).json({
      status: 'success',
      requestTime: req.requestTime,
      message: message,
      data: {
        data,
      },
    });
  });
};

//get all
exports.getAllHandler = (model, stausCode, message) => {
  return catchAsync(async (req, res, next) => {
    const features = new ApiFeatures(model, req.query)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    //  const data = await features.query.explain();
    const data = await features.query;
    res.status(stausCode).json({
      status: 'success',
      requestTime: req.requestTime,
      message: message,
      results: data.length,
      data: {
        data,
      },
    });
  });
};
