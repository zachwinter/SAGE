// src/app.ts
const { Logger, idGenerator, processUserData, sum, safeParseJSON, SimpleCalculator } = require('./utils/helpers');
const { User, ID, MenuItem, Shape, DeepPartial, ExtractPromiseType } = require('../../types/common');

// Function demonstrating complex logic and type usage
async function initializeApplication(config) {
  Logger.info('Application initialization started.');

  if (config.debugMode) {
    Logger.warn('Running in debug mode!');
  }

  const userIdGen = idGenerator();
  const newUserId = userIdGen.next().value;

  let currentUser;
  if (config.initialUser) {
    currentUser = processUserData({
      id: newUserId,
      name: config.initialUser.name || 'Guest',
      email: config.initialUser.email || 'guest@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: config.initialUser.roles || ['user'],
      ...config.initialUser,
    });
  } else {
    currentUser = processUserData({
      id: newUserId,
      name: 'Default User',
      email: 'default@example.com',
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: ['user'],
    });
  }

  Logger.info(`Current user: ${currentUser.name} (${currentUser.id})`);

  const calc = new SimpleCalculator(10);
  calc.add(5).subtract(2);
  Logger.info(`Calculator value: ${calc.value}`);

  const resultSum = sum(10, 20);
  Logger.info(`Sum of numbers: ${resultSum}`);

  const resultConcat = sum('Hello, ', 'World!');
  Logger.info(`Concatenated strings: ${resultConcat}`);

  const jsonString = '{"key": "value", "num": 123}';
  const parsed = safeParseJSON(jsonString);
  if (parsed) {
    Logger.info('Parsed JSON:', parsed);
  }

  const invalidJson = '{invalid';
  safeParseJSON(invalidJson);

  // Example of a complex menu structure
  const mainMenu = [
    { id: '1', label: 'Dashboard' },
    {
      id: '2',
      label: 'Settings',
      children: [
        { id: '2.1', label: 'Profile' },
        { id: '2.2', label: 'Privacy', action: (p) => Logger.info('Privacy action:', p) },
      ],
    },
  ];
  Logger.info('Main menu items:', mainMenu.length);

  // Example of discriminated union usage
  const circle = { kind: 'circle', radius: 5 };
  const square = { kind: 'square', sideLength: 10 };

  if (circle.kind === 'circle') {
    Logger.info(`Circle radius: ${circle.radius}`);
  }

  // Simulate an async operation
  return new Promise((resolve) => {
    setTimeout(() => {
      Logger.info('Application initialized successfully.');
      resolve(currentUser);
    }, 100);
  });
}

// Export the main initialization function
module.exports = { initializeApplication };

// Immediately invoked function to start the app
(async () => {
  const appUser = await initializeApplication({ debugMode: true, initialUser: { name: 'Test User' } });
  Logger.info(`App started with user: ${appUser.name}`);
})();
