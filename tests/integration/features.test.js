// end to end tests against a real MongoDB (set MONGO_URL, e.g. in CI)
jest.mock('../../utils/email');
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const Email = require('../../utils/email');
const totp = require('../../utils/totp');
const app = require('../../app');
const User = require('../../models/userModel');
const Tour = require('../../models/tourModel');
const Booking = require('../../models/bookingModel');
const Review = require('../../models/reviewModel');
const RefreshToken = require('../../models/refreshTokenModel');

const describeDb = process.env.MONGO_URL ? describe : describe.skip;

// url passed to the last Email created (the link in the email)
const lastEmailUrl = () => Email.mock.calls[Email.mock.calls.length - 1][1];

const cookie = (res, name) => {
  const header = (res.headers['set-cookie'] || []).find((c) =>
    c.startsWith(`${name}=`),
  );
  return header ? header.split(';')[0].split('=')[1] : undefined;
};

let counter = 0;
const newUserData = () => {
  counter += 1;
  return {
    name: `Tester ${counter}`,
    email: `tester${counter}-${Date.now()}@example.com`,
    password: 'pass12345',
    passwordConfirm: 'pass12345',
  };
};

// sign up + confirm email, returns { agent, user, token }
const createUser = async ({ confirm = true } = {}) => {
  const agent = request.agent(app);
  const data = newUserData();
  const res = await agent.post('/api/v1/users/SignUp').send(data);
  expect(res.status).toBe(201);
  if (confirm) {
    const token = lastEmailUrl().split('/confirm-email/')[1];
    const confirmRes = await request(app).get(
      `/api/v1/users/confirmEmail/${token}`,
    );
    expect(confirmRes.status).toBe(200);
  }
  return { agent, data, user: res.body.data.user, token: res.body.token };
};

let tourCounter = 0;
const createTour = () => {
  tourCounter += 1;
  return Tour.create({
    name: `Integration tour ${tourCounter}`,
    duration: 5,
    maxGroupSize: 10,
    difficulty: 'easy',
    price: 500,
    summary: 'A tour for tests',
    description: 'Line one\nLine two',
    imageCover: 'tour-1-cover.jpg',
    images: ['tour-1-1.jpg', 'tour-1-2.jpg', 'tour-1-3.jpg'],
    startDates: [new Date('2030-06-01')],
    startLocation: {
      type: 'Point',
      coordinates: [-80.185942, 25.774772],
      description: 'Miami, USA',
    },
    locations: [],
  });
};

describeDb('integration (MongoDB)', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URL);
    await mongoose.connection.dropDatabase();
    await Promise.all(
      [User, Tour, Booking, Review, RefreshToken].map((m) => m.syncIndexes()),
    );
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  describe('sign up & email confirmation', () => {
    test('role in the sign up body is ignored', async () => {
      const res = await request(app)
        .post('/api/v1/users/SignUp')
        .send({ ...newUserData(), role: 'admin' });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('user');
      expect(res.body.data.user.emailConfirmed).toBe(false);
      expect(res.body.data.user.emailConfirmToken).toBeUndefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    test('confirmation link confirms the email once', async () => {
      const { user } = await createUser({ confirm: false });
      const token = lastEmailUrl().split('/confirm-email/')[1];
      expect(Email.prototype.sendConfirmEmail).toHaveBeenCalled();

      const page = await request(app).get(`/confirm-email/${token}`);
      expect(page.status).toBe(200);
      expect(page.text).toMatch(/Your email is confirmed/);
      expect((await User.findById(user._id)).emailConfirmed).toBe(true);

      const again = await request(app).get(`/confirm-email/${token}`);
      expect(again.status).toBe(400);
    });

    test('unconfirmed users can not book and can resend the email', async () => {
      const { agent } = await createUser({ confirm: false });
      const tour = await createTour();
      const res = await agent.get(
        `/api/v1/bookings/checkout-session/${tour._id}`,
      );
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/confirm your email/);

      const resend = await agent.post('/api/v1/users/resendConfirmation');
      expect(resend.status).toBe(200);
    });
  });

  describe('login, refresh tokens & sessions', () => {
    test('login returns an access token and a refresh token', async () => {
      const { data } = await createUser();
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(cookie(res, 'jwt')).toBeDefined();
      expect(cookie(res, 'refreshToken')).toBeDefined();
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('wrong password is rejected', async () => {
      const { data } = await createUser();
      const res = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    });

    test('refresh token is rotated and can only be used once', async () => {
      const { data } = await createUser();
      const login = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      const first = login.body.refreshToken;

      const refreshed = await request(app)
        .post('/api/v1/users/refreshToken')
        .send({ refreshToken: first });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.refreshToken).not.toBe(first);

      const reused = await request(app)
        .post('/api/v1/users/refreshToken')
        .send({ refreshToken: first });
      expect(reused.status).toBe(401);
    });

    test('expired access token is renewed from the refresh cookie', async () => {
      const { data, user } = await createUser();
      const login = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      const refreshToken = login.body.refreshToken;
      const expired = jwt.sign(
        { id: user._id, exp: Math.floor(Date.now() / 1000) - 10 },
        process.env.JWT_SECRET,
      );

      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', `jwt=${expired}; refreshToken=${refreshToken}`);
      expect(res.status).toBe(200);
      expect(cookie(res, 'jwt')).toBeDefined();

      // without the refresh cookie the expired token fails
      const noRefresh = await request(app)
        .get('/api/v1/users/me')
        .set('Cookie', `jwt=${expired}`);
      expect(noRefresh.status).toBe(401);
    });

    test('logout revokes the refresh token', async () => {
      const { data } = await createUser();
      const login = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      const logout = await request(app)
        .post('/api/v1/users/logout')
        .send({ refreshToken: login.body.refreshToken });
      expect(logout.status).toBe(200);
      const res = await request(app)
        .post('/api/v1/users/refreshToken')
        .send({ refreshToken: login.body.refreshToken });
      expect(res.status).toBe(401);
    });

    test('changing the password logs out old sessions and tokens', async () => {
      const { data, user } = await createUser();
      const login = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      const oldToken = jwt.sign(
        { id: user._id, iat: Math.floor(Date.now() / 1000) - 60 },
        process.env.JWT_SECRET,
        { expiresIn: '15m' },
      );

      const change = await request(app)
        .patch('/api/v1/users/updatePassword')
        .set('Authorization', `Bearer ${login.body.token}`)
        .send({
          currentPassword: data.password,
          password: 'newpass12345',
          passwordConfirm: 'newpass12345',
        });
      expect(change.status).toBe(200);

      const old = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${oldToken}`);
      expect(old.status).toBe(401);

      const oldRefresh = await request(app)
        .post('/api/v1/users/refreshToken')
        .send({ refreshToken: login.body.refreshToken });
      expect(oldRefresh.status).toBe(401);
    });

    test('forgot password does not reveal unknown emails and reset works', async () => {
      const unknown = await request(app)
        .post('/api/v1/users/forgetPassword')
        .send({ email: 'nobody-here@example.com' });
      expect(unknown.status).toBe(200);

      const { data } = await createUser();
      const res = await request(app)
        .post('/api/v1/users/forgetPassword')
        .send({ email: data.email });
      expect(res.status).toBe(200);
      const url = lastEmailUrl();
      expect(url).toMatch(/\/reset-password\//);
      const token = url.split('/reset-password/')[1];

      const page = await request(app).get(`/reset-password/${token}`);
      expect(page.status).toBe(200);

      const reset = await request(app)
        .patch(`/api/v1/users/resetPassword/${token}`)
        .send({ password: 'resetpass123', passwordConfirm: 'resetpass123' });
      expect(reset.status).toBe(200);

      const login = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: 'resetpass123' });
      expect(login.status).toBe(200);
    });
  });

  describe('two-factor authentication', () => {
    test('setup, enable, login with code, replay blocked, disable', async () => {
      const { agent, data } = await createUser();

      const setup = await agent.post('/api/v1/users/2fa/setup');
      expect(setup.status).toBe(200);
      expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/);
      const { secret } = setup.body.data;

      const bad = await agent
        .post('/api/v1/users/2fa/enable')
        .send({ code: '000000' });
      expect(bad.status).toBe(400);

      // use the code of the previous 30s window for enabling so the current
      // one is still unused for the login below
      const enable = await agent
        .post('/api/v1/users/2fa/enable')
        .send({ code: totp.generateToken(secret, Date.now() - 30000) });
      expect(enable.status).toBe(200);

      const noCode = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      expect(noCode.status).toBe(401);
      expect(noCode.body.twoFactorRequired).toBe(true);

      const code = totp.generateToken(secret);
      const withCode = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password, code });
      expect(withCode.status).toBe(200);

      const replay = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password, code });
      expect(replay.status).toBe(401);

      const disable = await agent
        .post('/api/v1/users/2fa/disable')
        .set('Authorization', `Bearer ${withCode.body.token}`)
        .send({ password: data.password, code: totp.generateToken(secret) });
      expect(disable.status).toBe(200);

      const plain = await request(app)
        .post('/api/v1/users/login')
        .send({ email: data.email, password: data.password });
      expect(plain.status).toBe(200);
    });
  });

  describe('bookings, reviews & favorites', () => {
    test('a tour can not be booked twice', async () => {
      const { agent, user } = await createUser();
      const tour = await createTour();
      await Booking.create({ tour: tour._id, user: user._id, price: 500 });

      const res = await agent.get(
        `/api/v1/bookings/checkout-session/${tour._id}`,
      );
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already booked/);
    });

    test('admins can not create the same booking twice', async () => {
      const { user } = await createUser();
      const admin = await createUser();
      await User.updateOne({ _id: admin.user._id }, { role: 'admin' });
      const tour = await createTour();

      const body = { tour: tour._id, user: user._id, price: 500 };
      const first = await admin.agent
        .post('/api/v1/bookings/newBooking')
        .send(body);
      expect(first.status).toBe(201);
      const second = await admin.agent
        .post('/api/v1/bookings/newBooking')
        .send(body);
      expect(second.status).toBe(400);
    });

    test('only users who booked can review, once, and only edit their own', async () => {
      const author = await createUser();
      const other = await createUser();
      const tour = await createTour();

      const notBooked = await author.agent
        .post(`/api/v1/tours/${tour._id}/reviews`)
        .send({ review: 'Great!', rating: 5 });
      expect(notBooked.status).toBe(403);

      await Booking.create({ tour: tour._id, user: author.user._id, price: 1 });

      // the tour page shows the review form now
      const page = await author.agent.get(`/tour/${tour.slug}`);
      expect(page.status).toBe(200);
      expect(page.text).toMatch(/form--review/);

      const created = await author.agent
        .post(`/api/v1/tours/${tour._id}/reviews`)
        .send({ review: 'Great!', rating: 4, user: other.user._id });
      expect(created.status).toBe(201);
      // the user can not be spoofed
      expect(String(created.body.data.data.user)).toBe(
        String(author.user._id),
      );

      const twice = await author.agent
        .post(`/api/v1/tours/${tour._id}/reviews`)
        .send({ review: 'Again', rating: 3 });
      expect(twice.status).toBe(400);

      const reviewId = created.body.data.data._id;
      const foreignDelete = await other.agent.delete(
        `/api/v1/reviews/${reviewId}`,
      );
      expect(foreignDelete.status).toBe(403);

      const mine = await author.agent.get('/api/v1/reviews/my-reviews');
      expect(mine.body.results).toBe(1);
      expect(mine.body.data.reviews[0].tour.name).toBe(tour.name);

      const myPage = await author.agent.get('/my-reviews');
      expect(myPage.text).toMatch(/Great!/);

      const ownDelete = await author.agent.delete(
        `/api/v1/reviews/${reviewId}`,
      );
      expect(ownDelete.status).toBe(204);
    });

    test('favorites: only booked tours, no duplicates, remove', async () => {
      const { agent, user } = await createUser();
      const tour = await createTour();

      const notBooked = await agent.post(`/api/v1/users/favorites/${tour._id}`);
      expect(notBooked.status).toBe(403);

      await Booking.create({ tour: tour._id, user: user._id, price: 1 });

      const added = await agent.post(`/api/v1/users/favorites/${tour._id}`);
      expect(added.status).toBe(200);
      const duplicate = await agent.post(`/api/v1/users/favorites/${tour._id}`);
      expect(duplicate.status).toBe(400);

      const list = await agent.get('/api/v1/users/favorites');
      expect(list.body.results).toBe(1);
      expect(list.body.data.tours[0].name).toBe(tour.name);

      const page = await agent.get('/my-favorites');
      expect(page.text).toContain(tour.name);

      const removed = await agent.delete(`/api/v1/users/favorites/${tour._id}`);
      expect(removed.status).toBe(200);
      const again = await agent.delete(`/api/v1/users/favorites/${tour._id}`);
      expect(again.status).toBe(404);
    });
  });

  describe('pages', () => {
    test('overview, tour and account pages render', async () => {
      const tour = await createTour();
      const { agent } = await createUser();

      expect((await request(app).get('/')).status).toBe(200);
      const tourPage = await request(app).get(`/tour/${tour.slug}`);
      expect(tourPage.status).toBe(200);
      expect(tourPage.text).toContain(tour.name);

      const account = await agent.get('/me');
      expect(account.status).toBe(200);
      expect(account.text).toMatch(/Two-factor authentication/);

      expect((await agent.get('/my-tours')).status).toBe(200);
      expect((await request(app).get('/tour/does-not-exist')).status).toBe(404);
    });

    test('health is ok with a database', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.database).toBe('connected');
    });
  });
});
