import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QwenDeviceAuth,
  QwenAuthEventType,
  QwenAuthEvent,
  qwenAuthEvents
} from "../QwenDeviceAuth";
import crypto from "crypto";
import { promises as fs } from "node:fs";
import * as os from "os";
import open from "open";

// Mock external dependencies
vi.mock("crypto");
vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      unlink: vi.fn()
    }
  };
});
vi.mock("os");
vi.mock("open");
vi.mock("../utils/colors", () => ({
  error: vi.fn().mockImplementation(msg => msg),
  highlight: vi.fn().mockImplementation(msg => msg),
  info: vi.fn().mockImplementation(msg => msg),
  success: vi.fn().mockImplementation(msg => msg),
  warning: vi.fn().mockImplementation(msg => msg)
}));
vi.mock("../utils/progress", () => ({
  ProgressBar: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    finish: vi.fn()
  }))
}));

describe.skip("QwenDeviceAuth", () => {
  let qwenAuth: QwenDeviceAuth;
  let mockFetch: any;

  beforeEach(() => {
    qwenAuth = new QwenDeviceAuth();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock crypto functions
    (crypto.randomBytes as any).mockReturnValue(Buffer.from("test-code-verifier"));
    (crypto.createHash as any).mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("test-code-challenge")
    });

    // Mock os.homedir
    (os.homedir as any).mockReturnValue("/test/home");

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Remove all event listeners
    qwenAuthEvents.removeAllListeners();
  });

  describe("authenticate", () => {
    it("should return true when cached credentials are valid", async () => {
      // Mock valid cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(fs.readFile).toHaveBeenCalled();
    });

    it("should start device flow when no cached credentials", async () => {
      // Mock no cached credentials
      (fs.readFile as any).mockRejectedValue(new Error("File not found"));

      // Mock device flow methods to resolve immediately
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });

    it("should handle errors during authentication", async () => {
      // Mock no cached credentials
      (fs.readFile as any).mockRejectedValue(new Error("File not found"));

      // Mock device flow to throw error
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockRejectedValue(new Error("Auth failed"));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(false);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });

    it("should emit auth success event when cached credentials are valid", async () => {
      // Mock valid cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      const authSuccessSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, authSuccessSpy);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(authSuccessSpy).toHaveBeenCalled();
    });

    it("should handle invalid cached credentials gracefully", async () => {
      // Mock invalid cached credentials (missing access_token)
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      // Mock device flow to succeed
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });
  });

  describe("startDeviceFlow", () => {
    it("should successfully complete the device flow", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("should emit auth events during device flow", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const authUriSpy = vi.fn();
      const authSuccessSpy = vi.fn();
      const authProgressSpy = vi.fn();

      qwenAuthEvents.on(QwenAuthEvent.AuthUri, authUriSpy);
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, authSuccessSpy);
      qwenAuthEvents.on(QwenAuthEvent.AuthProgress, authProgressSpy);

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(true);
      expect(authUriSpy).toHaveBeenCalled();
      expect(authSuccessSpy).toHaveBeenCalled();
      expect(authProgressSpy).toHaveBeenCalled();
    });

    it("should handle browser opening failure gracefully", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock token response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      // Mock open to throw an error
      (open as any).mockRejectedValue(new Error("Browser failed to open"));

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(true);
      expect(open).toHaveBeenCalled();
    });

    it("should handle device code request failure", async () => {
      // Mock device code response failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request")
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle invalid device code response", async () => {
      // Mock device code response with missing fields
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          // Missing required fields
          expires_in: 3600
        })
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle network errors during device code request", async () => {
      // Mock network error
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle polling timeout", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock token polling to always return authorization_pending
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "authorization_pending"
        })
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(false);
      // Should have called fetch multiple times for polling
      expect(mockFetch).toHaveBeenCalledTimes(151); // 1 for device code + 150 polling attempts
    });

    it("should handle rate limiting during polling", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock first few polling attempts as rate limited
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: vi.fn().mockResolvedValue({})
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "slow_down"
        })
      });

      // Then succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should handle cancellation during polling", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock token polling to delay so we can cancel
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "authorization_pending"
        })
      });

      // Start the flow and cancel quickly
      const flowPromise = qwenAuth.startDeviceFlow();

      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 10));
      qwenAuth.cancelAuth();

      const result = await flowPromise;

      expect(result).toBe(false);
    });

    it("should handle invalid token response", async () => {
      // Mock device code response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          device_code: "test-device-code",
          user_code: "TEST-CODE",
          verification_uri: "https://example.com/verify",
          verification_uri_complete:
            "https://example.com/verify?user_code=TEST-CODE",
          expires_in: 3600
        })
      });

      // Mock invalid token response (missing access_token)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      const result = await qwenAuth.startDeviceFlow();

      expect(result).toBe(false);
    });
  });

  describe("cancelAuth", () => {
    it("should cancel ongoing authentication", () => {
      // Mock an ongoing authentication
      (qwenAuth as any).cancellationToken = {
        abort: vi.fn()
      };

      const authCancelSpy = vi.fn();
      const authFailureSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthCancelled, authCancelSpy);
      qwenAuthEvents.on(QwenAuthEventType.AuthFailure, authFailureSpy);

      qwenAuth.cancelAuth();

      expect((qwenAuth as any).cancellationToken.abort).toHaveBeenCalled();
      expect(authCancelSpy).toHaveBeenCalled();
      expect(authFailureSpy).toHaveBeenCalled();
      expect((qwenAuth as any).cancellationToken).toBeNull();
    });

    it("should do nothing when no authentication is in progress", () => {
      qwenAuth.cancelAuth();
      expect((qwenAuth as any).cancellationToken).toBeNull();
    });

    it("should properly clean up cancellation token", () => {
      // Mock an ongoing authentication
      (qwenAuth as any).cancellationToken = {
        abort: vi.fn()
      };

      qwenAuth.cancelAuth();

      expect((qwenAuth as any).cancellationToken).toBeNull();
    });
  });

  describe("getAccessToken", () => {
    it("should return access token when valid", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        expiry_date: Date.now() + 3600000 // 1 hour in future
      };

      const token = await qwenAuth.getAccessToken();

      expect(token).toBe("test-token");
    });

    it("should return null when no credentials", async () => {
      const token = await qwenAuth.getAccessToken();

      expect(token).toBeNull();
    });

    it("should return null when token is expired and no refresh token", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      const token = await qwenAuth.getAccessToken();

      expect(token).toBeNull();
    });

    it("should refresh token when expired and refresh token available", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      // Mock refresh token response
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const token = await qwenAuth.getAccessToken();

      expect(token).toBe("new-access-token");
      expect(mockFetch).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it("should handle token refresh failure", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      // Mock refresh token failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request")
      });

      const token = await qwenAuth.getAccessToken();

      expect(token).toBeNull();
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle invalid refresh token response", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      // Mock invalid refresh token response (missing access_token)
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          refresh_token: "new-refresh-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      const token = await qwenAuth.getAccessToken();

      expect(token).toBeNull();
    });

    it("should show token expiry information for valid tokens", async () => {
      const futureExpiry = Date.now() + 3600000; // 1 hour in future
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        expiry_date: futureExpiry
      };

      const token = await qwenAuth.getAccessToken();

      expect(token).toBe("test-token");
    });

    it("should handle network errors during token refresh", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      // Mock network error
      mockFetch.mockRejectedValue(new Error("Network error"));

      const token = await qwenAuth.getAccessToken();

      expect(token).toBeNull();
    });

    it("should keep existing refresh token when not provided in response", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "existing-refresh-token",
        expiry_date: Date.now() - 3600000 // 1 hour ago
      };

      // Mock refresh token response without refresh_token
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "new-access-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      const token = await qwenAuth.getAccessToken();

      expect(token).toBe("new-access-token");
      expect((qwenAuth as any).credentials.refresh_token).toBe(
        "existing-refresh-token"
      );
    });

    it("should load cached credentials when none in memory", async () => {
      // Mock cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          access_token: "cached-token",
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      const token = await qwenAuth.getAccessToken();

      expect(token).toBe("cached-token");
      expect(fs.readFile).toHaveBeenCalled();
    });
  });

  describe("getResourceUrl", () => {
    it("should return resource URL when credentials exist", () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        resource_url: "https://api.example.com"
      };

      const url = qwenAuth.getResourceUrl();

      expect(url).toBe("https://api.example.com");
    });

    it("should return null when no credentials", () => {
      const url = qwenAuth.getResourceUrl();

      expect(url).toBeNull();
    });

    it("should return null when credentials exist but no resource URL", () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token"
      };

      const url = qwenAuth.getResourceUrl();

      expect(url).toBeNull();
    });
  });

  describe("clearCredentials", () => {
    it("should clear credentials and delete file", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token"
      };

      await qwenAuth.clearCredentials();

      expect((qwenAuth as any).credentials).toBeNull();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it("should handle file deletion errors gracefully", async () => {
      (fs.unlink as any).mockRejectedValue(new Error("File not found"));

      await qwenAuth.clearCredentials();

      // Should not throw error
      expect(true).toBe(true);
    });

    it("should clear credentials even when no credentials exist", async () => {
      (qwenAuth as any).credentials = null;

      await qwenAuth.clearCredentials();

      expect((qwenAuth as any).credentials).toBeNull();
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe("loadCachedCredentials", () => {
    it("should load valid cached credentials", async () => {
      // Mock valid cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      const result = await (qwenAuth as any).loadCachedCredentials();

      expect(result).toBe(true);
      expect((qwenAuth as any).credentials).toBeDefined();
      expect((qwenAuth as any).credentials.access_token).toBe("test-token");
    });

    it("should reject cached credentials without access token", async () => {
      // Mock invalid cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          expiry_date: Date.now() + 3600000 // 1 hour in future
        })
      );

      const result = await (qwenAuth as any).loadCachedCredentials();

      expect(result).toBe(false);
    });

    it("should reject expired cached credentials", async () => {
      // Mock expired cached credentials
      (fs.readFile as any).mockResolvedValue(
        JSON.stringify({
          access_token: "test-token",
          expiry_date: Date.now() - 3600000 // 1 hour ago
        })
      );

      const result = await (qwenAuth as any).loadCachedCredentials();

      expect(result).toBe(false);
    });

    it("should handle file read errors gracefully", async () => {
      // Mock file not found error
      (fs.readFile as any).mockRejectedValue(new Error("File not found"));

      const result = await (qwenAuth as any).loadCachedCredentials();

      expect(result).toBe(false);
    });

    it("should handle invalid JSON in cached credentials", async () => {
      // Mock invalid JSON
      (fs.readFile as any).mockResolvedValue("invalid json");

      const result = await (qwenAuth as any).loadCachedCredentials();

      expect(result).toBe(false);
    });
  });

  describe("cacheCredentials", () => {
    it("should cache credentials to file", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token",
        refresh_token: "test-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000
      };

      await (qwenAuth as any).cacheCredentials();

      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.mkdir).toHaveBeenCalled();
    });

    it("should not cache when no credentials", async () => {
      (qwenAuth as any).credentials = null;

      await (qwenAuth as any).cacheCredentials();

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it("should handle file write errors gracefully", async () => {
      (qwenAuth as any).credentials = {
        access_token: "test-token"
      };

      (fs.writeFile as any).mockRejectedValue(new Error("Write error"));

      await (qwenAuth as any).cacheCredentials();

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe("getCredentialPath", () => {
    it("should return correct credential file path", () => {
      const path = (qwenAuth as any).getCredentialPath();

      expect(path).toBe("/test/home/.sage/qwen_creds.json");
    });
  });

  describe("refreshToken", () => {
    it("should successfully refresh token", async () => {
      // Mock refresh token response
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "new-access-token",
          refresh_token: "new-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const result = await (qwenAuth as any).refreshToken("test-refresh-token");

      expect(result).toBeDefined();
      expect(result.access_token).toBe("new-access-token");
      expect(result.refresh_token).toBe("new-refresh-token");
      expect(result.token_type).toBe("Bearer");
    });

    it("should handle refresh token request failure", async () => {
      // Mock refresh token failure
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Bad Request")
      });

      await expect(
        (qwenAuth as any).refreshToken("test-refresh-token")
      ).rejects.toThrow("Token refresh failed: 400 - Bad Request");
    });

    it("should handle invalid refresh token response", async () => {
      // Mock invalid refresh token response (missing access_token)
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          refresh_token: "new-refresh-token",
          token_type: "Bearer",
          expires_in: 3600
        })
      });

      await expect(
        (qwenAuth as any).refreshToken("test-refresh-token")
      ).rejects.toThrow("Invalid token refresh response: missing required fields");
    });

    it("should handle network errors during refresh", async () => {
      // Mock network error
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        (qwenAuth as any).refreshToken("test-refresh-token")
      ).rejects.toThrow("Failed to refresh token: Network error");
    });
  });

  describe("pollForToken", () => {
    it("should successfully poll for token", async () => {
      // Mock successful token response
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const result = await (qwenAuth as any).pollForToken(
        "test-device-code",
        "test-code-verifier"
      );

      expect(result).toBe(true);
    });

    it("should handle authorization pending responses", async () => {
      // Mock first response as authorization_pending
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "authorization_pending"
        })
      });

      // Then succeed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "Bearer",
          expires_in: 3600,
          resource_url: "https://api.example.com"
        })
      });

      const result = await (qwenAuth as any).pollForToken(
        "test-device-code",
        "test-code-verifier"
      );

      expect(result).toBe(true);
    });

    it("should handle timeout after max attempts", async () => {
      // Mock all responses as authorization_pending
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "authorization_pending"
        })
      });

      await expect(
        (qwenAuth as any).pollForToken("test-device-code", "test-code-verifier")
      ).rejects.toThrow("Authentication timeout after 5 minutes");
    });

    it("should handle cancellation during polling", async () => {
      // Create a cancellation token
      (qwenAuth as any).cancellationToken = {
        signal: {
          aborted: false
        }
      };

      // Mock response as authorization_pending
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          error: "authorization_pending"
        })
      });

      // Set up cancellation
      setTimeout(() => {
        (qwenAuth as any).cancellationToken.signal.aborted = true;
      }, 50);

      await expect(
        (qwenAuth as any).pollForToken("test-device-code", "test-code-verifier")
      ).rejects.toThrow("Authentication cancelled");
    });
  });
});
