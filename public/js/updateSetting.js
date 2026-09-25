import axios from 'axios';
import { showAlert } from './alert';
//update user name email / password
export const updateData = async (data, type) => {
  try {
    const url =
      type === 'password'
        ? '/api/v1/users/updatePassword'
        : '/api/v1/users/updateMe';
    const res = await axios.patch(url, data);
    if (res.data.status === 'success') {
      showAlert('success', res.data.message);
      //reload window after one second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    showAlert(
      'error',
      (error.response && error.response.data && error.response.data.message) ||
        'Something went wrong! Please try again',
    );
  }
};
