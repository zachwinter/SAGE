function caller() {
  const result = target();
  helper.process(result);
  return result;
}

function target(): string {
  return "hello";
}

const helper = {
  process(data: any) {
    console.log("Processing:", data);
    validate(data);
  }
};

function validate(input: any): boolean {
  if (!input) {
    throw new Error("Invalid input");
  }
  return true;
}

async function asyncCaller() {
  const data = await fetchData();
  return processData(data);
}

async function fetchData(): Promise<any> {
  return Promise.resolve({ test: "data" });
}

function processData(data: any) {
  return data.test;
}

// Nested function calls
function complexCaller() {
  return helper.process(target().toUpperCase());
}

// Method chaining
function chainCaller() {
  return "hello".toUpperCase().toLowerCase().charAt(0);
}
