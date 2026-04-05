const SESSION_KEY = 'sukdo.mini.session';
const BEST_TIMES_KEY = 'sukdo.mini.best-times';

function normalizeBestTimes(raw) {
  return {
    easy: Number.isInteger(raw?.easy) ? raw.easy : null,
    medium: Number.isInteger(raw?.medium) ? raw.medium : null,
    hard: Number.isInteger(raw?.hard) ? raw.hard : null
  };
}

module.exports = {
  BEST_TIMES_KEY,
  SESSION_KEY,
  normalizeBestTimes
};
