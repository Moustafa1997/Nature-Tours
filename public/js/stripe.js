/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);

    // 2) Redirect to the stripe hosted checkout page
    window.location.assign(session.data.session.url);
  } catch (err) {
    showAlert('error', err.response?.data?.message || 'Something went wrong');
  }
};
