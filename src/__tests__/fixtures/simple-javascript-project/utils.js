// Simple utility functions for testing
function add(a, b) {
  return a + b;
}

function multiply(x, y) {
  return x * y;
}

const divide = (numerator, denominator) => {
  if (denominator === 0) {
    throw new Error("Cannot divide by zero");
  }
  return numerator / denominator;
};

// Export using CommonJS
module.exports = {
  add,
  multiply,
  divide
};

// Also test mixed export styles
exports.subtract = function (a, b) {
  return a - b;
};

exports.power = (base, exponent) => Math.pow(base, exponent);
