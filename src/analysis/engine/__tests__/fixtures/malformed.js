// This file has intentional syntax errors for testing fallback parsing

function broken( {
  // missing closing parenthesis and brace

var incomplete = function() {
  return "missing semicolon"
}

class Partial {
  method(a, b {
    // missing closing parenthesis
  }

// Unclosed string
const badString = "this string never ends

export { incomplete, Partial