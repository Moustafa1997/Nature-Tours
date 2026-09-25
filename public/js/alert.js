export const showAlert = (type, msg) => {
  const alert = document.createElement('div');
  alert.className = `alert alert--${type}`;
  // textContent so messages coming from the server can never inject html
  alert.textContent = msg;
  document.querySelector('body').prepend(alert);
  window.setTimeout(() => {
    alert.remove();
  }, 2000);
};
