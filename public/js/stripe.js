/* eslint-disable */
import axios from 'axios';
import { showAlert } from './alert';
const stripe = Stripe(
  'pk_test_51OG6u1EIZ0pW75sWOr5ubuPKXJI4p9YW84ngEwJ8XHSSRB3n7YsWqQEREHqRADnqfi3V0AiM9dtYzsUyjO4ZmU6T00ibUSAziF',
);

export const bookTour = async (tourId) => {
  try {
    // 1) Get checkout session from API
    const session = await axios(`/api/v1/bookings/checkout-session/${tourId}`);
    // console.log(session);

    // 2) Create checkout form + chanre credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
