import axios from 'axios';
import { showAlert } from './alert';

const errorMessage = (err) =>
  (err.response && err.response.data && err.response.data.message) ||
  'Something went wrong! Please try again';

export const postReview = async (tourId, rating, review) => {
  try {
    await axios.post(`/api/v1/tours/${tourId}/reviews`, { rating, review });
    showAlert('success', 'Thank you for your review!');
    window.setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};

export const deleteReview = async (reviewId) => {
  try {
    await axios.delete(`/api/v1/reviews/${reviewId}`);
    showAlert('success', 'Review deleted');
    window.setTimeout(() => location.reload(), 1000);
  } catch (err) {
    showAlert('error', errorMessage(err));
  }
};

export const toggleFavorite = async (tourId, isFavorite) => {
  try {
    const res = await axios({
      method: isFavorite ? 'DELETE' : 'POST',
      url: `/api/v1/users/favorites/${tourId}`,
    });
    showAlert('success', res.data.message);
    return !isFavorite;
  } catch (err) {
    showAlert('error', errorMessage(err));
    return isFavorite;
  }
};
