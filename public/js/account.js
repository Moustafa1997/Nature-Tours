import axios from 'axios';
import { showAlert } from './alert';

const errorMessage = (err) =>
  (err.response && err.response.data && err.response.data.message) ||
  'Something went wrong! Please try again';

export const resendConfirmation = async () => {
  try {
    const res = await axios.post('/api/v1/users/resendConfirmation');
    showAlert('success', res.data.message);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};

// returns { qrCode, secret } to show to the user
export const setupTwoFactor = async () => {
  try {
    const res = await axios.post('/api/v1/users/2fa/setup');
    return res.data.data;
  } catch (err) {
    showAlert('error', errorMessage(err));
    return null;
  }
};

export const enableTwoFactor = async (code) => {
  try {
    const res = await axios.post('/api/v1/users/2fa/enable', { code });
    showAlert('success', res.data.message);
    window.setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};

export const disableTwoFactor = async (password, code) => {
  try {
    const res = await axios.post('/api/v1/users/2fa/disable', {
      password,
      code,
    });
    showAlert('success', res.data.message);
    window.setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};
