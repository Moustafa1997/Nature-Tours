const mongoose = require('mongoose');
const slugify = require('slugify');
const validator = require('validator');
const User = require('./userModel');
const tourScema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'],
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less or equal then 40 characters'],
      minlength: [7, 'A tour name must have more or equal then 10 characters'],
      // validate: [validator.isAlpha, 'Tour name must only contain characters'],
    },
    slug: {
      type: String,
    },
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration'],
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size'],
      
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      trim: true,
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either: easy, medium, difficult',
      },
    },
    //typed  option schema
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      // round valut such a 4.6666  =>4.7
      set: (val) => Math.round(val * 10) / 10,
      
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'],
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function (val) {
          //this only points to current doc on NEW document creation
          return val < this.price;
        },
        message: `Discount price({VALUE})should be below regular price`,
      },
    },
    summary: {
      type: String,
      trim: true,
      required: [true, 'A tour must have a description'],
    },
    description: {
      type: String,
      trim: true,
    },
    imageCover: {
      type: String,
      required: [true, 'A tour must have a cover image'],
    },
    images: {
      type: [String],
      // required: [true, 'A tour must have images'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      select: false,
    },
    startDates: [
      {
        type: Date,
        default: Date.now(),
      },
    ],

    //add location
    startLocation: {
      type: {
        type: String,
        default: 'Point',
        enum: ['Point'],
      },
      coordinates: [Number],

      address: String,
      description: String,
    },
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point'],
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number,
      },
    ],

    secretTour: {
      type: Boolean,
      default: false,
    },
    guides: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
      },
    ],
    //add virtual property to schema
  },

  //options
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
//

//add virtual property to schema
tourScema.virtual('durationWeek').get(function () {
  return this.duration / 7;
  // console.log(this.duration/7)
});
//document middleware
// pre : this will be executen only before save().create()  events
tourScema.pre('save', function (next) {
  this.slug = slugify(this.name, { lower: true });
  next();
});
/* // POST   middle ware run after sav event
tourScema.post('save', function (doc,next) {
 // console.log(doc);

  next();
}); */

//  pre query middleware run before any execute query
tourScema.pre(/^find/, function (next) {
  this.find({ secretTour: { $ne: true } });
  this.start = Date.now();
  next();
});
/* // post query middke ware run after excecute query
tourScema.post(/(find)/g, function (doc, next) {
  console.log(doc);
}) */

/* aggregation  middleware*/
// pre aggregate event
tourScema.pre('aggregate', function (next) {
  // console.log(this.pipeline());

  // console.log(this.pipeline());
  // if geonear if firts stage
  const firstStage = this.pipeline()[1];
  if (firstStage && firstStage.hasOwnProperty('$geoNear')) {
    this.pipeline().unshift({ $match: { secretTour: { $ne: true } } });
  }
  next();
});
// post aggregate event
/* tourScema.post('aggregate', function (doc, next) {
  console.log(doc);
}) */

/* //pre middleware to get guides data ralated to id by embbdding
tourScema.pre('save', async function (next) {
  const guidesPromises = this.guides.map(async (id) => await User.findById(id));
  this.guides = await Promise.all(guidesPromises);
  next();
});
 */

//pre middleware to get ref data ralated by populate  ref
tourScema.pre(/^find/, function (next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt',
  });
  next();
});

//add  virtial property to get reviews in single tour
tourScema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour',
  localField: '_id',
});

// here we create index so mongo can fetch only document needed not all of data
tourScema.index({ price: 1, ratingsAverage: -1 });
tourScema.index({
  slug: 1,
});
tourScema.index({
  startLocation: '2dsphere',
});

const Tour = mongoose.model('Tour', tourScema);

module.exports = Tour;
