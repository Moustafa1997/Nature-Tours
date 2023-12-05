import axios from 'axios';
import { showAlert } from './alert';

export const login = async (email, password) => {
  //console.log(email, password);
  try {
    const res = await axios({
      method: 'POST',
      url: '/api/v1/users/login',
      data: {
        email,
        password,
      },
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged in successfully');
      window.setTimeout(() => {
        location.assign('/');
      }, 1000);
    }

    //console.log(res);
  } catch (err) {
    showAlert('error', err.response.data.message);
    //console.log(err.response);
  }
};
// log out
export const logout = async () => {
  try {
    const res = await axios({
      method: 'GET',
      url: '/api/v1/users/logout',
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Logged Out Successfully');
      location.reload(true);
      location.assign('/');
    }
  } catch (err) {
    showAlert('error', 'error logging out ! try again');
  }
};
