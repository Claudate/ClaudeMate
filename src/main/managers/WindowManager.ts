/**
 * WindowManager - 管理 Electron 窗口的创建和生命周期
 * 负责主窗口的创建、加载和事件处理
 */

import { BrowserWindow, app, shell, nativeImage } from 'electron';
import { join } from 'path';
import { Logger } from '../utils/Logger';


export class WindowManager {
  private static instance: WindowManager;
  private mainWindow: BrowserWindow | null = null;
  private logger = Logger.getInstance('WindowManager');

  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  async createMainWindow(): Promise<void> {
    if (this.mainWindow) {
      this.logger.warn('Main window already exists');
      return;
    }

    this.logger.info('Creating main window...');

    // 获取图标路径
    const iconPath = join(__dirname, '../../resources/icon.png');
    this.logger.debug(`Icon path: ${iconPath}`);

    // 创建浏览器窗口
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      show: false, // 开始时隐藏窗口，等待页面加载完成
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      backgroundColor: '#1e1e1e', // VSCode dark background
      icon: nativeImage.createFromPath(iconPath), // 设置应用图标
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false, // Required for some Electron APIs
        webSecurity: true,
        allowRunningInsecureContent: false,
      },
    });

    this.logger.info('BrowserWindow created successfully');

    // 加载渲染进程
    if (app.isPackaged) {
      // 生产环境:使用file协议加载打包后的文件
      const appPath = join(__dirname, '../renderer/index.html');
      this.logger.debug(`Loading renderer file: ${appPath}`);
      this.mainWindow.loadFile(appPath);
    } else {
      // 开发环境:连接 Vite 开发服务器
      const url = 'http://localhost:5173';
      this.logger.debug(`Loading dev server: ${url}`);
      await this.mainWindow.loadURL(url);

      // 开发环境下打开 DevTools
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 窗口加载完成后显示
    this.mainWindow.once('ready-to-show', () => {
      if (this.mainWindow) {
        this.mainWindow.show();
        this.mainWindow.focus();
        this.logger.info('Main window is ready and shown');
        
        // 检查 preload 脚本是否成功加载
        this.mainWindow.webContents.executeJavaScript(`
          setTimeout(() => {
            if (window.electronAPI) {
              console.log('[WindowManager] electronAPI is available after window ready');
            } else {
              console.error('[WindowManager] electronAPI is NOT available after window ready');
            }
          }, 1000);
        `);
      }
    });

    // 窗口关闭事件
    this.mainWindow.on('closed', () => {
      this.logger.info('Main window closed');
      this.mainWindow = null;
    });

    // 优化性能:当窗口不可见时减少渲染
    this.mainWindow.on('hide', () => {
      this.logger.debug('Main window hidden');
    });

    this.mainWindow.on('show', () => {
      this.logger.debug('Main window shown');
    });
  }

  async closeMainWindow(): Promise<void> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.close();
      this.mainWindow = null;
      this.logger.info('Main window closed by manager');
    }
  }

  sendToRenderer(channel: string, ...args: any[]): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, ...args);
    } else {
      this.logger.warn('Cannot send to renderer: main window not available');
    }
  }

  minimizeMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.minimize();
      this.logger.debug('Main window minimized');
    }
  }

  maximizeMainWindow(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (this.mainWindow.isMaximized()) {
        this.mainWindow.unmaximize();
        this.logger.debug('Main window unmaximized');
      } else {
        this.mainWindow.maximize();
        this.logger.debug('Main window maximized');
      }
    }
  }

  isMaximized(): boolean {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      return this.mainWindow.isMaximized();
    }
    return false;
  }

  async clearCache(): Promise<void> {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      try {
        await this.mainWindow.webContents.session.clearCache();
        this.logger.info('Browser cache cleared');
      } catch (error) {
        this.logger.error('Failed to clear browser cache:', error);
      }
    }
  }
}
