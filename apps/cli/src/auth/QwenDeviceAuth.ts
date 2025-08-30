import crypto from "crypto";
import { EventEmitter } from "events";
import { promises as fs } from "node:fs";
import path from "node:path";
import open from "open";
import * as os from "os";
import { ProgressBar } from "../../../../packages/utils/src/progress.js";
import { error, highlight, info, success, warning } from "../utils/colors.js";

// OAuth Endpoints
const QWEN_OAUTH_BASE_URL = "https://chat.qwen.ai";
const QWEN_OAUTH_DEVICE_CODE_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/device/code`;
const QWEN_OAUTH_TOKEN_ENDPOINT = `${QWEN_OAUTH_BASE_URL}/api/v1/oauth2/token`;

// OAuth Client Configuration
const QWEN_OAUTH_CLIENT_ID = "f0304373b74a44d2b584a3fb70ca9e56";
const QWEN_OAUTH_SCOPE = "openid profile email model.completion";
const QWEN_OAUTH_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

// File System Configuration
const QWEN_DIR = ".sage";
const QWEN_CREDENTIAL_FILENAME = "qwen_creds.json";

// Event types
export enum QwenAuthEventType {
  AuthSuccess = "auth-success",
  AuthFailure = "auth-failure",
  TokenRefreshed = "token-refreshed"
}

interface QwenCredentials {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expiry_date?: number;
  resource_url?: string;
}

interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  resource_url?: string;
}

export enum QwenAuthEvent {
  AuthUri = "auth-uri",
  AuthProgress = "auth-progress",
  AuthCancel = "auth-cancel",
  AuthCancelled = "auth-cancelled"
}

export const qwenAuthEvents = new EventEmitter();

/**
 * Generate PKCE code verifier and challenge pair
 */
function generatePKCEPair(): { code_verifier: string; code_challenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256");
  hash.update(codeVerifier);
  const codeChallenge = hash.digest("base64url");
  return { code_verifier: codeVerifier, code_challenge: codeChallenge };
}

/**
 * Convert object to URL-encoded form data
 */
function objectToUrlEncoded(data: Record<string, string>): string {
  return Object.keys(data)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join("&");
}

export class QwenDeviceAuth {
  private credentials: QwenCredentials | null = null;
  private cancellationToken: AbortController | null = null;

  async authenticate(): Promise<boolean> {
    console.log(info("🔍 Checking for cached Qwen credentials..."));

    // Check for cached credentials first
    if (await this.loadCachedCredentials()) {
      console.log(success("✅ Loaded cached Qwen credentials"));
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);
      return true;
    }

    console.log(
      info("🔐 No valid cached credentials found, starting device flow...")
    );
    // Start device flow
    return await this.startDeviceFlow();
  }

  cancelAuth(): void {
    if (this.cancellationToken) {
      console.log("🛑 Cancelling authentication...");
      this.cancellationToken.abort();
      this.cancellationToken = null;
      qwenAuthEvents.emit(QwenAuthEvent.AuthCancelled);
      qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);
    }
  }

  async startDeviceFlow(): Promise<boolean> {
    // Create a new cancellation token for this flow
    this.cancellationToken = new AbortController();

    try {
      const { code_verifier, code_challenge } = generatePKCEPair();

      // Request device authorization
      const deviceAuth = await this.requestDeviceCode(code_challenge);

      // Emit auth URI event for UI
      qwenAuthEvents.emit(QwenAuthEvent.AuthUri, deviceAuth);

      console.log(highlight("🔐 Qwen Authentication Required"));
      console.log(info("Opening browser for authorization..."));
      console.log(highlight(`User code: ${deviceAuth.user_code}`));

      // Try to open browser
      try {
        await open(deviceAuth.verification_uri_complete);
      } catch {
        console.log(info(`Please visit: ${deviceAuth.verification_uri_complete}`));
      }

      // Poll for token
      console.log(info("⏳ Waiting for authentication..."));
      const success = await this.pollForToken(deviceAuth.device_code, code_verifier);

      if (success) {
        console.log(success("✅ Qwen authentication successful!"));
        this.cancellationToken = null; // Clear the token as we're done
        qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);
        return true;
      }

      console.log(error("❌ Qwen authentication failed or cancelled"));
      this.cancellationToken = null; // Clear the token
      qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);
      return false;
    } catch (error) {
      // Check if this was a cancellation
      if (error instanceof Error && error.name === "AbortError") {
        console.log(warning("🛑 Authentication cancelled by user"));
        qwenAuthEvents.emit(QwenAuthEvent.AuthCancelled);
        qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);
        this.cancellationToken = null; // Clear the token
        return false;
      }

      console.error(
        error("❌ Qwen authentication failed:"),
        error instanceof Error ? error.message : String(error)
      );
      this.cancellationToken = null; // Clear the token
      qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);
      return false;
    }
  }

  private async requestDeviceCode(
    codeChallenge: string
  ): Promise<DeviceAuthResponse> {
    try {
      console.log(info("📡 Requesting device code from Qwen..."));

      const body = objectToUrlEncoded({
        client_id: QWEN_OAUTH_CLIENT_ID,
        scope: QWEN_OAUTH_SCOPE,
        code_challenge: codeChallenge,
        code_challenge_method: "S256"
      });

      const response = await fetch(QWEN_OAUTH_DEVICE_CODE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(
          `Device authorization failed: ${response.status} - ${errorText}`
        );
      }

      const data = await response.json();

      // Validate required fields
      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error(
          "Invalid device authorization response: missing required fields"
        );
      }

      console.log(success("✅ Device code received successfully"));
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to request device code: ${error.message}`);
      }
      throw new Error("Failed to request device code: Unknown error");
    }
  }

  private async pollForToken(
    deviceCode: string,
    codeVerifier: string
  ): Promise<boolean> {
    const maxAttempts = 150; // 5 minutes with 2-second intervals
    let pollInterval = 2000;
    let lastProgressUpdate = 0;

    console.log(info("📡 Polling for token... (This may take a minute)"));
    const progressBar = new ProgressBar(maxAttempts, "⏳ Progress: ");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Check if cancelled
      if (this.cancellationToken?.signal.aborted) {
        throw new Error("Authentication cancelled");
      }

      // Update progress bar
      progressBar.update(attempt);

      try {
        const body = objectToUrlEncoded({
          grant_type: QWEN_OAUTH_GRANT_TYPE,
          client_id: QWEN_OAUTH_CLIENT_ID,
          device_code: deviceCode,
          code_verifier: codeVerifier
        });

        const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Accept: "application/json"
          },
          body,
          signal: this.cancellationToken?.signal // Pass cancellation token to fetch
        });

        // Check if cancelled after the request
        if (this.cancellationToken?.signal.aborted) {
          throw new Error("Authentication cancelled");
        }

        if (response.ok) {
          const tokenData: TokenResponse = await response.json();

          // Validate required fields
          if (!tokenData.access_token || !tokenData.token_type) {
            throw new Error("Invalid token response: missing required fields");
          }

          this.credentials = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_type: tokenData.token_type,
            resource_url: tokenData.resource_url,
            expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000
          };

          await this.cacheCredentials();
          qwenAuthEvents.emit(
            QwenAuthEvent.AuthProgress,
            "success",
            "Authentication successful!"
          );
          progressBar.finish();
          return true;
        }

        const errorData = await response.json().catch(() => ({}));

        if (response.status === 400 && errorData.error === "authorization_pending") {
          // Still waiting for user authorization
          // Show progress every 10 seconds
          if (Date.now() - lastProgressUpdate > 10000) {
            const secondsWaited = Math.round((attempt * pollInterval) / 1000);
            process.stdout.write(
              `${info("⏳ Still waiting for authorization...")} (${secondsWaited}s elapsed)`
            );
            lastProgressUpdate = Date.now();
          }
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        if (
          response.status === 429 ||
          (errorData.error && errorData.error === "slow_down")
        ) {
          // Rate limited, slow down
          const oldInterval = pollInterval;
          pollInterval = Math.min(pollInterval * 1.5, 10000);
          console.log(
            `${warning("⚠️  Rate limited, slowing down polling from")} ${oldInterval}ms to ${pollInterval}ms`
          );
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        // Handle other errors
        const errorMessage =
          errorData.error_description ||
          errorData.error ||
          `HTTP ${response.status}`;
        throw new Error(`Token request failed: ${errorMessage}`);
      } catch (error) {
        // Check if this was a cancellation
        if (error instanceof Error && error.name === "AbortError") {
          progressBar.finish();
          throw new Error("Authentication cancelled");
        }

        // For network errors or other issues, retry unless it's the last attempt
        if (attempt === maxAttempts - 1) {
          progressBar.finish();
          if (error instanceof Error) {
            throw new Error(
              `Authentication failed after ${maxAttempts} attempts: ${error.message}`
            );
          }
          throw new Error(
            `Authentication failed after ${maxAttempts} attempts: Unknown error`
          );
        }
        // Log the error but continue retrying
        console.debug(
          `${info("📡 Poll attempt")} ${attempt + 1} ${info("failed:")} ${error instanceof Error ? error.message : String(error)}`
        );
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    progressBar.finish();
    throw new Error("Authentication timeout after 5 minutes");
  }

  async getAccessToken(): Promise<string | null> {
    try {
      if (!this.credentials) {
        await this.loadCachedCredentials();
      }

      if (!this.credentials?.access_token) {
        return null;
      }

      // Check if token is still valid (30 second buffer)
      if (
        this.credentials.expiry_date &&
        Date.now() > this.credentials.expiry_date - 30000
      ) {
        const expiredAgo = Math.round(
          (Date.now() - this.credentials.expiry_date) / 1000
        );
        console.log(warning(`⚠️  Token expired ${expiredAgo} seconds ago`));

        // Token expired, try to refresh or re-authenticate
        if (this.credentials.refresh_token) {
          try {
            const newCredentials = await this.refreshToken(
              this.credentials.refresh_token
            );
            this.credentials = newCredentials;
            await this.cacheCredentials();
            return this.credentials.access_token;
          } catch (error) {
            console.error(
              error("❌ Token refresh failed:"),
              error instanceof Error ? error.message : String(error)
            );
            // Fall back to null, which will trigger re-authentication
            return null;
          }
        }
        return null;
      } else if (this.credentials.expiry_date) {
        // Show token expiry information
        const expiresIn = Math.round(
          (this.credentials.expiry_date - Date.now()) / 1000
        );
        const expiresAt = new Date(
          this.credentials.expiry_date
        ).toLocaleTimeString();
        console.log(
          info(`🕒 Token expires in ${expiresIn} seconds at ${expiresAt}`)
        );
      }

      return this.credentials.access_token;
    } catch (error) {
      console.error(
        error("❌ Error getting access token:"),
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  private async refreshToken(refreshToken: string): Promise<QwenCredentials> {
    try {
      console.log(info("🔄 Refreshing Qwen OAuth token..."));

      const body = objectToUrlEncoded({
        grant_type: "refresh_token",
        client_id: QWEN_OAUTH_CLIENT_ID,
        refresh_token: refreshToken
      });

      const response = await fetch(QWEN_OAUTH_TOKEN_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const tokenData: TokenResponse = await response.json();

      // Validate required fields
      if (!tokenData.access_token || !tokenData.token_type) {
        throw new Error("Invalid token refresh response: missing required fields");
      }

      const newCredentials = {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || refreshToken, // Keep existing if not provided
        token_type: tokenData.token_type,
        resource_url: tokenData.resource_url,
        expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000
      };

      console.log(success("✅ Token refreshed successfully"));
      // Emit token refreshed event
      qwenAuthEvents.emit(QwenAuthEventType.TokenRefreshed);

      return newCredentials;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to refresh token: ${error.message}`);
      }
      throw new Error("Failed to refresh token: Unknown error");
    }
  }

  getResourceUrl(): string | null {
    return this.credentials?.resource_url || null;
  }

  async clearCredentials(): Promise<void> {
    this.credentials = null;
    try {
      await fs.unlink(this.getCredentialPath());
    } catch {
      // File doesn't exist, that's fine
    }
  }

  private async loadCachedCredentials(): Promise<boolean> {
    try {
      const credPath = this.getCredentialPath();
      const credData = await fs.readFile(credPath, "utf-8");
      this.credentials = JSON.parse(credData);

      // Validate required fields
      if (!this.credentials.access_token) {
        console.debug(warning("Cached credentials missing access token"));
        return false;
      }

      // Verify token is still valid
      const token = await this.getAccessToken();
      return !!token;
    } catch (error) {
      if (error instanceof Error && error.name !== "ENOENT") {
        // Log error unless it's file not found (which is expected)
        console.debug(warning("Failed to load cached credentials:"), error.message);
      }
      return false;
    }
  }

  private async cacheCredentials(): Promise<void> {
    if (!this.credentials) return;

    const credPath = this.getCredentialPath();
    await fs.mkdir(path.dirname(credPath), { recursive: true });
    await fs.writeFile(credPath, JSON.stringify(this.credentials, null, 2));
  }

  private getCredentialPath(): string {
    return path.join(os.homedir(), QWEN_DIR, QWEN_CREDENTIAL_FILENAME);
  }
}

// Listen for cancellation events
qwenAuthEvents.on(QwenAuthEvent.AuthCancelled, () => {
  console.log(warning("🛑 Authentication process cancelled by user"));
});

export const qwenAuth = new QwenDeviceAuth();
