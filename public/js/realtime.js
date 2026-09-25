import { io } from 'socket.io-client';

// build a review card with DOM methods (no innerHTML => no XSS)
const reviewCard = ({ review, rating, user }) => {
  const card = document.createElement('div');
  card.className = 'reviews__card reviews__card--new';

  const avatar = document.createElement('div');
  avatar.className = 'reviews__avatar';
  const img = document.createElement('img');
  img.className = 'reviews__avatar-img';
  img.src = `/img/users/${encodeURIComponent(user.photo || 'default.jpg')}`;
  img.alt = user.name;
  const name = document.createElement('h6');
  name.className = 'reviews__user';
  name.textContent = user.name;
  avatar.append(img, name);

  const text = document.createElement('p');
  text.className = 'reviews__text';
  text.textContent = review;

  const stars = document.createElement('div');
  stars.className = 'reviews__rating';
  [1, 2, 3, 4, 5].forEach((star) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute(
      'class',
      `reviews__star reviews__star--${rating >= star ? 'active' : 'inactive'}`,
    );
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS(
      'http://www.w3.org/1999/xlink',
      'xlink:href',
      '/img/icons.svg#icon-star',
    );
    svg.append(use);
    stars.append(svg);
  });

  card.append(avatar, text, stars);
  return card;
};

// live viewers + live reviews on a tour page
export const watchTour = (tourId, viewersEl) => {
  const socket = io();
  socket.on('connect', () => socket.emit('tour:join', tourId));

  socket.on('tour:viewers', ({ count }) => {
    const others = count - 1;
    viewersEl.textContent =
      others > 0
        ? `👀 ${others} other ${others === 1 ? 'person is' : 'people are'} looking at this tour right now`
        : '';
  });

  socket.on('review:new', (review) => {
    const reviews = document.querySelector('.reviews');
    if (reviews) reviews.prepend(reviewCard(review));
  });
};
