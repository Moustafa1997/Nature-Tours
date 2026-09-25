import axios from 'axios';
import { showAlert } from './alert';

const errorMessage = (err) =>
  (err.response && err.response.data && err.response.data.message) ||
  'Something went wrong! Please try again';

export const login = async (email, password, code) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: code ? { email, password, code } : { email, password },
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      window.setTimeout(() => {
        location.assign('/');
      }, 1000);
    }
  } catch (err) {
    // account protected with two-factor: ask for the code
    if (err.response && err.response.data && err.response.data.twoFactorRequired) {
      document.getElementById('code-group').classList.remove('hidden');
      document.getElementById('code').required = true;
      document.getElementById('code').focus();
    }
    showAlert('error', errorMessage(err));
  }
};
// log out
export const logout = async () => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/logout',
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged Out Successfully');
      location.assign('/');
    }
  } catch (err) {
    showAlert('error', 'error logging out ! try again');
  }
};

export const forgotPassword = async (email) => {
  try {
    const res = await axios.post('/api/v1/users/forgetPassword', { email });
    showAlert('success', res.data.message);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};

export const resetPassword = async (token, password, passwordConfirm) => {
  try {
    await axios.patch(`/api/v1/users/resetPassword/${encodeURIComponent(token)}`, {
      password,
      passwordConfirm,
    });
    showAlert('success', 'Password changed! You are now logged in');
    window.setTimeout(() => location.assign('/'), 1000);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};
