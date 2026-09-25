const User = require('../../models/userModel');
const Tour = require('../../models/tourModel');
const Review = require('../../models/reviewModel');

describe('model validation (no database needed)', () => {
  test('user requires a valid email and matching passwords', () => {
    const user = new User({
      name: 'Test User',
      email: 'not-an-email',
      password: 'pass1234',
      passwordConfirm: 'different',
    });
    const err = user.validateSync();
    expect(err.errors.email).toBeDefined();
    expect(err.errors.passwordConfirm).toBeDefined();
  });

  test('user role is limited and defaults to user', () => {
    const user = new User({ role: 'superadmin' });
    expect(user.validateSync().errors.role).toBeDefined();
    expect(new User({}).role).toBe('user');
  });

  test('old accounts without emailConfirmed count as confirmed', () => {
    expect(new User({}).isEmailConfirmed).toBe(true);
    expect(new User({ emailConfirmed: false }).isEmailConfirmed).toBe(false);
  });

  test('email confirmation token is stored hashed', () => {
    const user = new User({});
    const token = user.createEmailConfirmToken();
    expect(token).toHaveLength(64);
    expect(user.emailConfirmToken).not.toBe(token);
    expect(user.emailConfirmExpires.getTime()).toBeGreaterThan(Date.now());
  });

  test('tour difficulty and discount validation', () => {
    const tour = new Tour({
      name: 'A test tour',
      duration: 5,
      maxGroupSize: 10,
      difficulty: 'impossible',
      price: 100,
      priceDiscount: 200,
      summary: 'x',
      imageCover: 'x.jpg',
    });
    const err = tour.validateSync();
    expect(err.errors.difficulty).toBeDefined();
    expect(err.errors.priceDiscount).toBeDefined();
  });

  test('review rating must be between 1 and 5', () => {
    const review = new Review({ review: 'nice', rating: 6 });
    expect(review.validateSync().errors.rating).toBeDefined();
  });
});
