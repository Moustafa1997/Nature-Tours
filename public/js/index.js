import '@babel/polyfill';
import { login } from './login';
import { displayMap } from './mapbox';
import { logout } from './login';
import { updateData } from './updateSetting';
import { bookTour } from './stripe';

/* eslint-disable */
//dom elements
const mapBox = document.getElementById('map');
const loginForm = document.querySelector('.form--login');
const logOut = document.querySelector('.nav__el--logout');
const userdata = document.querySelector('.form-user-data');
const userPassword = document.querySelector('.form-user-password');
const bookBtn = document.getElementById('book-tour');

// values

// delegation
if (mapBox) {
  const locations = JSON.parse(mapBox.dataset.locations);
  displayMap(locations);
}
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    login(email, password);
  });
}
if (logOut) {
  logOut.addEventListener('click', logout);
}
if (userdata) {
  console.log(userdata);
  userdata.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    /*    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const photo = document.getElementById('photo').files[0];
    //const password = document.getElementById('password').value; */
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

    //console.log(currentPassword, password, passwordConfirm);

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
