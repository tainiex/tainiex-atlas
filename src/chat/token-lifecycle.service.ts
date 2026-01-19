import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

@Injectable()
export class TokenLifecycleService {
  private readonly logger = new Logger(TokenLifecycleService.name);
  private readonly REFRESH_BUFFER = 5 * 60 * 1000; // 5 minutes
  private tokenTimers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Schedules a notification for the client to refresh their token.
   */
  scheduleRefreshNotification(client: Socket, token: string) {
    try {
      const payload = this.jwtService.decode(token);
      if (!payload?.exp) return;

      const expiryTime = payload.exp * 1000;
      const now = Date.now();
      // Calculate time until we should notify (Expiry - Buffer)
      const notifyTime = expiryTime - this.REFRESH_BUFFER - now;

      if (notifyTime > 0) {
        this.logger.log(
          `Scheduling token refresh notification for client ${client.id} in ${Math.round(notifyTime / 1000)}s`,
        );

        const timer = setTimeout(() => {
          this.notifyClient(client, this.REFRESH_BUFFER / 1000);
        }, notifyTime);

        this.tokenTimers.set(client.id, timer);
      } else if (expiryTime > now) {
        // Token is valid but within buffer period, notify immediately
        this.logger.warn(
          `Token for client ${client.id} is already in refresh buffer period`,
        );
        this.notifyClient(client, (expiryTime - now) / 1000);
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule token refresh for ${client.id}`,
        error,
      );
    }
  }

  private notifyClient(client: Socket, expiresInSeconds: number) {
    if (client.connected) {
      client.emit('auth:token-expiring', {
        expiresIn: expiresInSeconds,
        action: 'refresh',
      });
      this.logger.log(`Notified client ${client.id} to refresh token`);
    } else {
      this.clearTimer(client.id);
    }
  }

  /**
   * Clears the scheduled timer for a client.
   */
  clearTimer(clientId: string) {
    const timer = this.tokenTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.tokenTimers.delete(clientId);
    }
  }

  async handleTokenRefreshed(client: Socket, newToken: string) {
    // Clear old timer
    this.clearTimer(client.id);

    try {
      // Verify new Token (Optional here if Gateway does it, but good for safety)
      const payload = await this.jwtService.verifyAsync(newToken);
      client.data.user = payload;

      // Reschedule
      this.scheduleRefreshNotification(client, newToken);

      client.emit('auth:token-renewed', { success: true });
      this.logger.log(`Client ${client.id} token refreshed successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to verify refreshed token for ${client.id}`,
        error,
      );
      client.emit('auth:error', { message: 'Invalid refresh token' });
    }
  }
}
