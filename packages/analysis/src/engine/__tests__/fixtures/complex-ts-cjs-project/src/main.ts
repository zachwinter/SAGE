// src/main.ts
const { initializeApplication } = require('./app');
const { Logger } = require('./utils/helpers');

async function startApp() {
  Logger.info('Main application starting...');
  const user = await initializeApplication({ debugMode: false });
  Logger.info(`Application started with user: ${user.name}`);
}

startApp().catch(Logger.error);
