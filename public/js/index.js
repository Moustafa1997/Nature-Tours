import { login, logout, forgotPassword, resetPassword } from './login';
import { signup } from './signup';
import { displayMap } from './mapbox';
import { updateData } from './updateSetting';
import { bookTour } from './stripe';
import {
  resendConfirmation,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from './account';
import { postReview, deleteReview, toggleFavorite } from './reviews';
import { watchTour } from './realtime';

/* eslint-disable */
//dom elements
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const signupForm = document.querySelector('.form--signup');
const forgotForm = document.querySelector('.form--forgot');
const resetForm = document.querySelector('.form--reset');
const logOut = document.querySelector('.nav__el--logout');
const userdata = document.querySelector('.form-user-data');
const userPassword = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');
const favoriteBtn = document.getElementById('favorite-tour');
const reviewForm = document.querySelector('.form--review');
const deleteReviewBtns = document.querySelectorAll('.btn--delete-review');
const resendBtn = document.getElementById('resend-confirmation');
const setup2faBtn = document.getElementById('setup-2fa');
const enable2faForm = document.querySelector('.form-2fa-enable');
const disable2faForm = document.querySelector('.form-2fa-disable');
const liveViewers = document.getElementById('live-viewers');

// delegation
if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  if (mapBox.dataset.token) displayMap(locations, mapBox.dataset.token);
}
if (liveViewers) {
  watchTour(liveViewers.dataset.tourId, liveViewers);
}
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const code = document.getElementById('code').value;

    login(email, password, code);
  });
}
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;
    if (!name || !email || !password || !passwordConfirm)
      return alert('All fields are required!');

    signup(name, email, password, passwordConfirm);
  });
}
if (forgotForm) {
  forgotForm.addEventListener('submit', (e) => {
    e.preventDefault();
    forgotPassword(document.getElementById('email').value);
  });
}
if (resetForm) {
  resetForm.addEventListener('submit', (e) => {
    e.preventDefault();
    resetPassword(
      resetForm.dataset.token,
      document.getElementById('password').value,
      document.getElementById('password-confirm').value,
    );
  });
}
if (logOut) {
  logOut.addEventListener('click', logout);
}
if (userdata) {
  userdata.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    const photo = document.getElementById('photo').files[0];
    if (photo) form.append('photo', photo);

    await updateData(form, 'data');
  });
}
if (userPassword) {
  userPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--save-password').textContent = 'Updating...';

    const currentPassword = document.getElementById('password-current').value;

    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await updateData(
      { currentPassword, password, passwordConfirm },
      'password',
    );
    document.querySelector('.btn--save-password').textContent = 'Save password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });
}
if (bookBtn) {
  bookBtn.addEventListener('click', (e) => {
    e.target.textContent = 'Processing...';
    const { tourId } = e.target.dataset;
    bookTour(tourId);
  });
}
if (favoriteBtn) {
  favoriteBtn.addEventListener('click', async () => {
    const isFavorite = favoriteBtn.dataset.favorite === 'true';
    const now = await toggleFavorite(favoriteBtn.dataset.tourId, isFavorite);
    favoriteBtn.dataset.favorite = String(now);
    favoriteBtn.textContent = now
      ? '♥ Remove from favorites'
      : '♡ Add to favorites';
  });
}
if (reviewForm) {
  reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();
    postReview(
      reviewForm.dataset.tourId,
      Number(document.getElementById('rating').value),
      document.getElementById('review-text').value,
    );
  });
}
deleteReviewBtns.forEach((btn) =>
  btn.addEventListener('click', () => {
    if (window.confirm('Delete this review?')) {
      deleteReview(btn.dataset.reviewId);
    }
  }),
);
if (resendBtn) {
  resendBtn.addEventListener('click', resendConfirmation);
}
if (setup2faBtn) {
  setup2faBtn.addEventListener('click', async () => {
    const data = await setupTwoFactor();
    if (!data) return;
    document.getElementById('qr-code').src = data.qrCode;
    document.getElementById('secret-key').textContent = data.secret;
    setup2faBtn.parentElement.classList.add('hidden');
    enable2faForm.classList.remove('hidden');
    document.getElementById('enable-code').focus();
  });
}
if (enable2faForm) {
  enable2faForm.addEventListener('submit', (e) => {
    e.preventDefault();
    enableTwoFactor(document.getElementById('enable-code').value);
  });
}
if (disable2faForm) {
  disable2faForm.addEventListener('submit', (e) => {
    e.preventDefault();
    disableTwoFactor(
      document.getElementById('disable-password').value,
      document.getElementById('disable-code').value,
    );
  });
}
