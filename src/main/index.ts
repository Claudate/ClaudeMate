/**
 * Electron Main Process Entry Point
 * Handles app lifecycle, window management, and system-level operations
 */

import { app, BrowserWindow, shell } from 'electron';
import { WindowManager } from './managers/WindowManager';
import { IPCManager } from './managers/IPCManager';
import { MemoryMonitor } from './monitors/MemoryMonitor';
import { Logger } from './utils/Logger';
import { ClaudeService } from './services/ClaudeService';
import { DatabaseService } from './services/DatabaseService';

const logger = Logger.getInstance('Main');

// Disable hardware acceleration for better memory management (optional)
// app.disableHardwareAcceleration();

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = WindowManager.getInstance().getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // App lifecycle handlers
  app.whenReady()
    .then(async () => {
      logger.info('App is ready');

      // Security: Limit navigation
      app.on('web-contents-created', (_event, contents) => {
        contents.on('will-navigate', (event, navigationUrl) => {
          const parsedUrl = new URL(navigationUrl);

          // Only allow navigation to same origin
          if (parsedUrl.origin !== 'http://localhost:5173') {
            event.preventDefault();
            logger.warn('Navigation blocked:', navigationUrl);
          }
        });

        // Security: Prevent new window creation
        contents.setWindowOpenHandler(({ url }) => {
          // Open external links in browser
          if (url.startsWith('http')) {
            shell.openExternal(url).catch(err => {
              logger.error('Failed to open external URL:', err);
            });
          }
          return { action: 'deny' };
        });
      });

      // Initialize managers
      const windowManager = WindowManager.getInstance();
      const ipcManager = IPCManager.getInstance();
      const memoryMonitor = MemoryMonitor.getInstance();
      const databaseService = DatabaseService.getInstance();

      // Initialize database
      await databaseService.initialize();
      logger.info('Database initialized');

      // Create main window
      await windowManager.createMainWindow();

      // Register IPC handlers
      await ipcManager.registerHandlers();

      // Start memory monitoring
      memoryMonitor.start();

      logger.info('Application initialized successfully');
    })
    .catch(err => {
      logger.error('Failed to initialize app:', err);
      app.quit();
    });

  app.on('activate', () => {
    // macOS: Re-create window when dock icon is clicked
    const windowManager = WindowManager.getInstance();
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createMainWindow().catch(err => {
        logger.error('Failed to create window on activate:', err);
      });
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', async () => {
    logger.info('App is quitting...');

    // Cleanup
    const memoryMonitor = MemoryMonitor.getInstance();
    memoryMonitor.stop();

    const claudeService = ClaudeService.getInstance();
    claudeService.cleanup();

    const databaseService = DatabaseService.getInstance();
    await databaseService.cleanup();

    logger.info('Cleanup completed');
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    // Don't quit immediately, try to save state
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection:', reason);
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  app.quit();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received');
  app.quit();
});
