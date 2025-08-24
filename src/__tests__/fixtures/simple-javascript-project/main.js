const { add, multiply, subtract } = require("./utils");

class Calculator {
  constructor() {
    this.history = [];
  }

  calculate(operation, a, b) {
    let result;

    switch (operation) {
      case "add":
        result = add(a, b);
        break;
      case "multiply":
        result = multiply(a, b);
        break;
      case "subtract":
        result = subtract(a, b);
        break;
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

    this.history.push({ operation, a, b, result, timestamp: new Date() });
    return result;
  }

  getHistory() {
    return this.history.slice();
  }

  clearHistory() {
    this.history = [];
  }
}

function runDemo() {
  const calc = new Calculator();

  console.log("Running calculator demo...");
  console.log("5 + 3 =", calc.calculate("add", 5, 3));
  console.log("10 * 2 =", calc.calculate("multiply", 10, 2));
  console.log("15 - 7 =", calc.calculate("subtract", 15, 7));

  console.log("History:", calc.getHistory());
}

module.exports = { Calculator, runDemo };
