// review schema
const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty!'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour.'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user.'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

//to create index  to  allow user only post onr reviews for one tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

// pre bmiddle ware in find
reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo -_id',
  });
  //   }).populate({
  //     path: 'tour',
  //     select: 'name price duration',
  //   });

  next();
});

//static methods to calc avg rating for a tour when post review
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  /*  console.log(stats);
  console.log(stats.length);
  console.log(stats[0]); */
  if (stats.length > 0) {
    // await Tour.findByIdAndUpdate(
    await this.model('Tour').findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await this.model('Tour').findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

reviewSchema.post('save', function () {
  //this.constructor === model  REview
  this.constructor.calcAverageRatings(this.tour);
});

 // change average rating when review is updated or deleted
reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});
reviewSchema.post(/^findOneAnd/, async function () {

   const model = this.r.constructor;
  await model.calcAverageRatings(this.r.tour);
})
module.exports=mongoose.model("Review",reviewSchema);
 