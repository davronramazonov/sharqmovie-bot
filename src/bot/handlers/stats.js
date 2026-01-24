const stats = {
  users: new Set(),
  totalOrders: 0,
  todayOrders: 0,
  lastDate: new Date().toDateString()
};

function trackUser(userId) {
  stats.users.add(userId);
}

function trackOrder() {
  const today = new Date().toDateString();
  if (stats.lastDate !== today) {
    stats.todayOrders = 0;
    stats.lastDate = today;
  }
  stats.totalOrders++;
  stats.todayOrders++;
}

function getStats() {
  return {
    users: stats.users.size,
    usersList: Array.from(stats.users),
    totalOrders: stats.totalOrders,
    todayOrders: stats.todayOrders
  };
}

module.exports = {
  trackUser,
  trackOrder,
  getStats
};
