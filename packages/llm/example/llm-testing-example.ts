// example/llm-testing-example.ts
// Example showing how to use @sage/test-utils to test LLM functionality

import { createChatStream, setProvider } from '@sage/llm';
import { makeLLM } from '@sage/test-utils/src/adapters/llm';

async function example() {
  console.log('=== LLM Testing Example ===');
  
  // 1. Create a deterministic test LLM client
  console.log('\n1. Creating deterministic test LLM...');
  const testLLM = makeLLM({ seed: 42 });
  setProvider(testLLM as any); // Type assertion needed due to interface differences
  
  // 2. Test basic chat functionality
  console.log('\n2. Testing basic chat functionality...');
  const stream = await createChatStream({
    model: "test-model",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, how are you?" }
    ]
  });
  
  // Collect and display events
  console.log('Streaming response:');
  for await (const event of stream) {
    if (event.type === "text") {
      process.stdout.write(event.text);
    }
  }
  console.log('\n');
  
  // 3. Test deterministic behavior
  console.log('\n3. Testing deterministic behavior...');
  const testLLM2 = makeLLM({ seed: 42 });
  setProvider(testLLM2 as any);
  
  const stream2 = await createChatStream({
    model: "test-model",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello, how are you?" }
    ]
  });
  
  const events2 = [];
  for await (const event of stream2) {
    events2.push(event);
  }
  
  const text2 = events2
    .filter(e => e.type === "text")
    .map(e => (e as any).text)
    .join('');
    
  console.log('Second response with same seed:', text2);
  
  // 4. Test with tools
  console.log('\n4. Testing with tools...');
  const testLLM3 = makeLLM({ 
    seed: 123,
    tools: {
      calculator: async (input: any) => {
        if (input.operation === 'add') {
          return input.a + input.b;
        }
        return 0;
      }
    }
  });
  
  setProvider(testLLM3 as any);
  
  const stream3 = await createChatStream({
    model: "test-model",
    messages: [
      { role: "user", content: "Calculate 5+7 using the calculator tool" }
    ],
    tools: [{
      name: "calculator",
      description: "A simple calculator tool",
      parameters: {
        type: "object",
        properties: {
          operation: { type: "string" },
          a: { type: "number" },
          b: { type: "number" }
        }
      }
    }]
  });
  
  console.log('Tool call response:');
  for await (const event of stream3) {
    switch (event.type) {
      case "text":
        process.stdout.write(event.text);
        break;
      case "tool_call":
        console.log(`\n[TOOL CALL] ${event.toolCall?.name}(${JSON.stringify(event.toolCall?.args)})`);
        break;
      case "tool_result":
        console.log(`\n[TOOL RESULT] ${JSON.stringify(event.toolResult?.result)}`);
        break;
    }
  }
  console.log('\n');
  
  console.log('=== Example Complete ===');
}

// Run the example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}

export { example };