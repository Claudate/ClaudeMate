/**
 * Claude Auth Manager - 认证管理模块
 * 负责处理 Claude CLI 的认证状态检查、登录和登出
 */

import { spawn } from 'child_process';
import { BaseClaudeModule } from './BaseClaudeModule';

export interface ClaudeAuthStatus {
  isAuthenticated: boolean;
  email?: string;
  subscription?: string;
}

export class ClaudeAuthManager extends BaseClaudeModule {
  private isAuthenticated = false;

  constructor(private getClaudeCliPath: () => string) {
    super('AuthManager');
  }

  /**
   * 检查认证状态
   */
  public async checkAuth(): Promise<ClaudeAuthStatus> {
    return new Promise((resolve) => {
      try {
        const claudeCliPath = this.getClaudeCliPath();
        this.logger.info(`Checking Claude CLI auth status: ${claudeCliPath}`);

        // 构建环境变量:继承并传递 OAuth token
        const env = { ...process.env };
        const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
        if (oauthToken) {
          env.CLAUDE_CODE_OAUTH_TOKEN = oauthToken;
          this.logger.info('CLAUDE_CODE_OAUTH_TOKEN found for auth check');
        }

        const check = spawn(claudeCliPath, ['auth', 'status'], {
          shell: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env,
        });

        let output = '';
        let errorOutput = '';
        let resolved = false;

        check.stdout?.on('data', (data: Buffer) => {
          output += data.toString();
        });

        check.stderr?.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        check.on('close', (code) => {
          if (!resolved) {
            resolved = true;
            this.logger.info(`Claude CLI auth check completed with code: ${code}`);
            this.logger.debug(`Auth check output: ${output}`);

            if (code === 0 && output.toLowerCase().includes('authenticated')) {
              this.isAuthenticated = true;

              // 尝试提取邮箱和订阅信息
              const emailMatch = output.match(/email:\s*([^\n]+)/i);
              const subMatch = output.match(/subscription:\s*([^\n]+)/i);

              resolve({
                isAuthenticated: true,
                email: emailMatch ? emailMatch[1].trim() : undefined,
                subscription: subMatch ? subMatch[1].trim() : undefined,
              });
            } else {
              this.isAuthenticated = false;
              resolve({ isAuthenticated: false });
            }
          }
        });

        check.on('error', (error) => {
          if (!resolved) {
            resolved = true;
            this.logger.error(`Claude CLI auth check error: ${error.message}`);
            this.isAuthenticated = false;
            resolve({ isAuthenticated: false });
          }
        });

        // Timeout - 15秒
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.logger.warn('Claude CLI auth check timed out after 15 seconds');
            if (!check.killed) {
              check.kill();
            }
            // 超时时假设已认证
            resolve({ isAuthenticated: true });
          }
        }, 15000);
      } catch (error) {
        this.logger.error('Failed to check Claude CLI auth:', error);
        resolve({ isAuthenticated: false });
      }
    });
  }

  /**
   * 登录 Claude CLI (opens browser for OAuth)
   */
  public async login(): Promise<boolean> {
    this.logger.info('Starting Claude CLI login...');

    return new Promise((resolve) => {
      const claudeCliPath = this.getClaudeCliPath();
      const loginProcess = spawn(claudeCliPath, ['auth', 'login'], {
        shell: true,
        stdio: 'inherit',
      });

      loginProcess.on('close', async (code) => {
        if (code === 0) {
          // 验证登录状态
          const status = await this.checkAuth();
          this.isAuthenticated = status.isAuthenticated;

          if (this.isAuthenticated) {
            this.logger.info('Claude CLI login successful');
            resolve(true);
          } else {
            this.logger.warn('Claude CLI login completed but auth check failed');
            resolve(false);
          }
        } else {
          this.logger.error(`Claude CLI login failed with code ${code}`);
          this.isAuthenticated = false;
          resolve(false);
        }
      });

      loginProcess.on('error', (error) => {
        this.logger.error('Claude CLI login error:', error);
        this.isAuthenticated = false;
        resolve(false);
      });
    });
  }

  /**
   * 登出 Claude CLI
   */
  public async logout(): Promise<boolean> {
    this.logger.info('Logging out from Claude CLI...');

    return new Promise((resolve) => {
      const claudeCliPath = this.getClaudeCliPath();
      const logoutProcess = spawn(claudeCliPath, ['auth', 'logout'], {
        shell: true,
        stdio: 'inherit',
      });

      logoutProcess.on('close', (code) => {
        if (code === 0) {
          this.isAuthenticated = false;
          this.logger.info('Claude CLI logout successful');
          resolve(true);
        } else {
          this.logger.error(`Claude CLI logout failed with code ${code}`);
          resolve(false);
        }
      });

      logoutProcess.on('error', (error) => {
        this.logger.error('Claude CLI logout error:', error);
        resolve(false);
      });
    });
  }

  /**
   * 获取认证状态 (同步)
   */
  public getAuthStatus(): boolean {
    return this.isAuthenticated;
  }
}
