import axios from 'axios';
import { showAlert } from './alert';
//update user name email;
export const updateData = async (data, type) => {
  try {
    const url =
      type === 'password'
        ? 'http://127.0.0.1:3000/api/v1/users/updatePassword'
        : 'http://127.0.0.1:3000/api/v1/users/updateMe';
    const res = await axios.patch(url, data);
    if (res.data.status === 'success') {
      showAlert('success', res.data.message);
      //reload window after one second
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    showAlert('error', error.response.data.message);
  }
};
/* export const updateData = async (name, email) => {
  try {
    const res = await axios({
      method: 'PATCH',
      url: 'http://127.0.0.1:3000/api/v1/users/updateMe',

      data: {
        name,
        email,
      },
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Updated Successfully');
      location.reload(true);
    }
  } catch (err) {
    showAlert('error', 'error updating ! try again');
  }
};
//update user password
export const updatePassword = async (
  oldPassword,
  newPassword,
  password_confirm,
) => {
  try {
    const res = await axios({
      method: 'PATCH',
      url: 'http://127.0.0.1:3000/api/v1/users/updatePassword',
      data: {
        oldPassword,
        newPassword,
        password_confirm,
      },
    });
    if (res.data.status === 'success') {
      showAlert('success', 'Updated Successfully');
      location.reload(true);
    }
  } catch (err) {
    showAlert('error', 'error updating ! try again');
  }
};
 */
