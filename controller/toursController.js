const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const factory = require(`${__dirname}/handler-Methods-Req`);
const AppError = require('./../utils/appError');
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
//upload multi-images for tour and one image cover
exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

//resize image middle ware
exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (req.files.imageCover) {
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
    //1) resize cover image
    // console.log(req.files);
    await sharp(req.files.imageCover[0].buffer)
      .resize(2000, 1333)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toFile(`public/img/tours/${req.body.imageCover}`);
  }

  if (!req.files.images) {
    return next();
  }
  //resize images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);
      req.body.images.push(filename);
    }),
  );
  next();
});

// to get top 5 tours
exports.aliasTopTours = (req, res, next) => {
  req.query.sort = '-ratingsAverage,price';
  (req.query.limit = '5'),
    (req.query.fields = 'name,price,ratingsAverage,difficulty,summary');
  next();
};
//to get all touro
exports.getAllTours = factory.getAllHandler(Tour, 200, 'ohh great tours');

// to delete tour
exports.deleteTour = factory.deleteHandler(
  Tour,
  204,
  'tour deleted successfuly',
);
// to post new tour
exports.createTour = factory.createHandler(
  Tour,
  201,
  'tour created successfuly',
);
//to update tour
exports.updateTour = factory.updateHandler(
  Tour,
  200,
  'tour updated successfuly',
);
//to get specific tour
exports.getTour = factory.getOneHandler(
  Tour,
  200,
  'tour found successfuly',
  'reviews',
);

//aggregation
exports.getTourStats = catchAsync(async (req, res) => {
  const stats = await Tour.aggregate([
    {
      $match: {
        ratingsAverage: { $gte: 4.5 },
      },
    },
    {
      $group: {
        _id: {
          $toUpper: '$difficulty',
        },
        numOfTours: {
          $sum: 1,
        },
        numOfRating: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minprice: { $min: '$price' },
        maxprice: { $max: '$price' },
      },
    },
    {
      $sort: {
        avgPrice: 1,
      },
    },

    /*  {
        $match: {
          _id: { $ne: 'EASY' },
        },
      } */
  ]);

  res.status(200).json({
    status: 'success',
    requestTime: req.requestTime,
    data: stats,
  });
});
exports.getMonthlyPlan = catchAsync(async (req, res) => {
  // console.log(req.params)
  const year = req.params.year * 1;
  // console.log(year)

  const plan = await Tour.aggregate([
    {
      $unwind: {
        path: '$startDates',
      },
    },
    //this just as aquery not display
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      //this what return to user
      $group: {
        _id: {
          $month: '$startDates',
        },
        numTourStart: {
          $sum: 1,
        },
        tours: {
          $push: '$name',
        },
      },
    },
    {
      $addFields: {
        month: '$_id',
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
    {
      $sort: {
        numTourStart: -1,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      plan,
    },
  });
});
//   '/tours-within/:distance/center/:latlng/unit/:unit',
//tourController.getToursWithin,
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  if (!lat || !lng) {
    next(
      new AppError(
        'please provide latitude and longitude in the format lat,lng',
        400,
      ),
    );
  }

  console.log('distance', distance);
  console.log('lat', lat);
  console.log('lng', lng);
  console.log('unit', unit);
  // get all tour within a certain radius of center point
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;

  // get all tour within a given radius of center point
  let tours = await Tour.find({
    startLocation: {
      $geoWithin: { $centerSphere: [[lng, lat], radius] },
    },
  });
  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours,
    },
  });
});

// Assuming you have a `Tour` model with a `startLocation` field that represents the coordinates of the tour's starting location

exports.calculateDistance = async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  if (!lat || !lng) {
    next(
      new AppError(
        'please provide latitude and longitude in the format lat,lng',
        400,
      ),
    );
  }
  //aggreagate
  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          type: 'Point',
          // Number(lng)
          coordinates: [lng * 1, lat * 1],
        },
        distanceField: 'distance',
        distanceMultiplier: unit === 'mi' ? 0.000621371 : 0.001,
      },
    },
    {
      $project: {
        distance: 1,
        name: 1,
      },
    },
    {
      $limit: 5,
    },
    {
      $sort: {
        distance: 1,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    results: distances.length,
    data: {
      data: distances,
    },
  });
};
