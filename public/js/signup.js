import axios from 'axios';
import { showAlert } from './alert';
// register user
export const signup = async (name, email, password, passwordConfirm) => {
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/SignUp',
      data: {
        name,
        email,
        password,
        passwordConfirm,
      },
    });

    if (res.data.status === 'success') {
      showAlert('success', 'Registered! Please check your email to confirm it');
      window.setTimeout(() => {
        location.assign('/me');
      }, 1500);
    }
  } catch (err) {
    showAlert(
      'error',
      (err.response && err.response.data && err.response.data.message) ||
        'Something went wrong! Please try again',
    );
  }
};
