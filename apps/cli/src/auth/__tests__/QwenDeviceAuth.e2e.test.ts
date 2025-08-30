import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  vi
} from "vitest";
import { QwenDeviceAuth, QwenAuthEventType, QwenAuthEvent } from "../QwenDeviceAuth";
import { promises as fs } from "node:fs";
import { homedir } from "os";
import { createServer } from "node:http";
import { error, highlight, info, success, warning } from "../../utils/colors";

// Mock the colors module to avoid actual console output
vi.mock("../../utils/colors", () => ({
  error: vi.fn().mockImplementation(msg => `ERROR: ${msg}`),
  highlight: vi.fn().mockImplementation(msg => `HIGHLIGHT: ${msg}`),
  info: vi.fn().mockImplementation(msg => `INFO: ${msg}`),
  success: vi.fn().mockImplementation(msg => `SUCCESS: ${msg}`),
  warning: vi.fn().mockImplementation(msg => `WARNING: ${msg}`)
}));

// Mock the progress bar to avoid actual console output
vi.mock("../../utils/progress", () => ({
  ProgressBar: vi.fn().mockImplementation(() => ({
    update: vi.fn(),
    finish: vi.fn()
  }))
}));

// Mock open to avoid actually opening browser
vi.mock("open", () => ({
  default: vi.fn().mockResolvedValue(undefined)
}));

// Mock os module to handle homedir in ESM
vi.mock("os", async () => {
  const actual = await vi.importActual("os");
  return {
    ...actual,
    homedir: vi.fn().mockReturnValue("/tmp/test-home")
  };
});

describe.skip("QwenDeviceAuth E2E Tests", () => {
  let qwenAuth: QwenDeviceAuth;
  let mockServer: any;
  let serverUrl: string;
  let deviceId = 0;

  // Create a mock OAuth server for testing
  beforeAll(async () => {
    mockServer = createServer((req, res) => {
      if (req.url === "/api/v1/oauth2/device/code" && req.method === "POST") {
        deviceId++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            device_code: `device-code-${deviceId}`,
            user_code: `USER-${deviceId}`,
            verification_uri: `${serverUrl}/verify`,
            verification_uri_complete: `${serverUrl}/verify?user_code=USER-${deviceId}`,
            expires_in: 3600
          })
        );
      } else if (req.url === "/api/v1/oauth2/token" && req.method === "POST") {
        let body = "";
        req.on("data", chunk => {
          body += chunk.toString();
        });
        req.on("end", () => {
          // Parse form data
          const params = new URLSearchParams(body);
          const grantType = params.get("grant_type");

          if (grantType === "urn:ietf:params:oauth:grant-type:device_code") {
            // Simulate successful authorization after a short delay
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: "test-access-token",
                refresh_token: "test-refresh-token",
                token_type: "Bearer",
                expires_in: 3600,
                resource_url: `${serverUrl}/api`
              })
            );
          } else if (grantType === "refresh_token") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                access_token: "refreshed-access-token",
                refresh_token: "new-refresh-token",
                token_type: "Bearer",
                expires_in: 3600,
                resource_url: `${serverUrl}/api`
              })
            );
          } else {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "invalid_grant",
                error_description: "Invalid grant type"
              })
            );
          }
        });
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    // Start server on a random port
    await new Promise<void>(resolve => {
      mockServer.listen(0, "127.0.0.1", () => {
        const address = mockServer.address();
        serverUrl = `http://${address.address}:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>(resolve => {
        mockServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Create a new instance for each test
    qwenAuth = new QwenDeviceAuth();

    // Override the OAuth endpoints to use our mock server
    (global as any).QWEN_OAUTH_BASE_URL = serverUrl;
    (global as any).QWEN_OAUTH_DEVICE_CODE_ENDPOINT =
      `${serverUrl}/api/v1/oauth2/device/code`;
    (global as any).QWEN_OAUTH_TOKEN_ENDPOINT = `${serverUrl}/api/v1/oauth2/token`;

    // Home directory is mocked at module level

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any stored credentials
    try {
      const credPath = `/tmp/test-home/.sage/qwen_creds.json`;
      await fs.unlink(credPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  describe("Full Authentication Flow", () => {
    it("should complete the full device authentication flow", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
      const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
      const mkdirSpy = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);

      const authSuccessSpy = vi.fn();
      const authUriSpy = vi.fn();

      // Listen for events
      qwenAuth["qwenAuthEvents"].on(QwenAuthEventType.AuthSuccess, authSuccessSpy);
      qwenAuth["qwenAuthEvents"].on(QwenAuthEvent.AuthUri, authUriSpy);

      // Run the authentication
      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(authSuccessSpy).toHaveBeenCalled();
      expect(authUriSpy).toHaveBeenCalled();
      expect(writeFileSpy).toHaveBeenCalled();
      expect(mkdirSpy).toHaveBeenCalled();

      // Verify we can get the access token
      const token = await qwenAuth.getAccessToken();
      expect(token).toBe("test-access-token");

      // Verify we can get the resource URL
      const resourceUrl = qwenAuth.getResourceUrl();
      expect(resourceUrl).toBe(`${serverUrl}/api`);
    });

    it("should load cached credentials", async () => {
      // Mock existing credentials file
      const mockCredentials = {
        access_token: "cached-access-token",
        refresh_token: "cached-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000, // 1 hour in future
        resource_url: `${serverUrl}/api`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);

      // Verify we can get the access token
      const token = await qwenAuth.getAccessToken();
      expect(token).toBe("cached-access-token");
    });

    it("should refresh expired token", async () => {
      // Mock expired credentials
      const mockCredentials = {
        access_token: "expired-access-token",
        refresh_token: "valid-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() - 3600000, // 1 hour ago
        resource_url: `${serverUrl}/api`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));
      const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);

      // Run authentication
      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(writeFileSpy).toHaveBeenCalled();

      // Verify we got a refreshed token
      const token = await qwenAuth.getAccessToken();
      expect(token).toBe("refreshed-access-token");
    });

    it("should handle authentication with missing refresh token", async () => {
      // Mock credentials without refresh token
      const mockCredentials = {
        access_token: "valid-access-token",
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000, // 1 hour in future
        resource_url: `${serverUrl}/api`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);

      // Verify we can get the access token
      const token = await qwenAuth.getAccessToken();
      expect(token).toBe("valid-access-token");
    });

    it("should handle authentication with expired token and no refresh token", async () => {
      // Mock expired credentials without refresh token
      const mockCredentials = {
        access_token: "expired-access-token",
        token_type: "Bearer",
        expiry_date: Date.now() - 3600000, // 1 hour ago
        resource_url: `${serverUrl}/api`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      // Should start device flow when token is expired and no refresh token
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });

    it("should handle authentication with invalid cached credentials", async () => {
      // Mock invalid credentials (missing access_token)
      const mockCredentials = {
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000, // 1 hour in future
        resource_url: `${serverUrl}/api`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      // Should start device flow when cached credentials are invalid
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle device code request failure", async () => {
      // Temporarily override the device code endpoint to an invalid URL
      const invalidEndpoint = `${serverUrl}/invalid/endpoint`;
      (global as any).QWEN_OAUTH_DEVICE_CODE_ENDPOINT = invalidEndpoint;

      // Mock fs to return no cached credentials
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(false);
    });

    it("should handle authentication cancellation", async () => {
      // Mock fs to return no cached credentials
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      // Start authentication but cancel it quickly
      const authPromise = qwenAuth.startDeviceFlow();

      // Wait a bit then cancel
      await new Promise(resolve => setTimeout(resolve, 100));
      qwenAuth.cancelAuth();

      const result = await authPromise;

      expect(result).toBe(false);
    });

    it("should handle network errors during device code request", async () => {
      // Override fetch to throw network error
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      // Mock fs to return no cached credentials
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(false);

      // Restore fetch
      global.fetch = originalFetch;
    });

    it("should handle invalid device code response", async () => {
      // Override the server to return invalid response
      const originalListener = mockServer.listeners("request")[0];
      mockServer.removeAllListeners("request");
      mockServer.on("request", (req: any, res: any) => {
        if (req.url === "/api/v1/oauth2/device/code" && req.method === "POST") {
          // Return response with missing required fields
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              expires_in: 3600
              // Missing device_code, user_code, verification_uri
            })
          );
        } else {
          originalListener(req, res);
        }
      });

      // Mock fs to return no cached credentials
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(false);

      // Restore original listener
      mockServer.removeAllListeners("request");
      mockServer.on("request", originalListener);
    });

    it("should handle token refresh failure", async () => {
      // Mock expired credentials
      const mockCredentials = {
        access_token: "expired-access-token",
        refresh_token: "invalid-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() - 3600000, // 1 hour ago
        resource_url: `${serverUrl}/api`
      };

      // Override the server to fail token refresh
      const originalListener = mockServer.listeners("request")[0];
      mockServer.removeAllListeners("request");
      mockServer.on("request", (req: any, res: any) => {
        if (req.url === "/api/v1/oauth2/token" && req.method === "POST") {
          let body = "";
          req.on("data", chunk => {
            body += chunk.toString();
          });
          req.on("end", () => {
            const params = new URLSearchParams(body);
            const grantType = params.get("grant_type");

            if (grantType === "refresh_token") {
              // Fail refresh token request
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  error: "invalid_grant",
                  error_description: "Invalid refresh token"
                })
              );
            } else {
              originalListener(req, res);
            }
          });
        } else {
          originalListener(req, res);
        }
      });

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      // Should fall back to device flow when refresh fails
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();

      // Restore original listener
      mockServer.removeAllListeners("request");
      mockServer.on("request", originalListener);
    });
  });

  describe("Credential Management", () => {
    it("should cache credentials to file", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));
      const writeFileSpy = vi.spyOn(fs, "writeFile").mockResolvedValue(undefined);
      const mkdirSpy = vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);

      // Complete authentication flow
      await qwenAuth.authenticate();

      expect(writeFileSpy).toHaveBeenCalled();
      expect(mkdirSpy).toHaveBeenCalled();

      // Verify the written credentials
      const call = writeFileSpy.mock.calls[0];
      const filePath = call[0];
      const fileContent = call[1];

      expect(filePath).toContain(".sage/qwen_creds.json");
      expect(fileContent).toContain("test-access-token");

      // Verify content is valid JSON
      const parsedContent = JSON.parse(fileContent as string);
      expect(parsedContent.access_token).toBe("test-access-token");
      expect(parsedContent.refresh_token).toBe("test-refresh-token");
      expect(parsedContent.token_type).toBe("Bearer");
      expect(parsedContent.resource_url).toBe(`${serverUrl}/api`);
    });

    it("should clear credentials", async () => {
      const unlinkSpy = vi.spyOn(fs, "unlink").mockResolvedValue(undefined);

      await qwenAuth.clearCredentials();

      expect((qwenAuth as any).credentials).toBeNull();
      expect(unlinkSpy).toHaveBeenCalled();
    });

    it("should handle clear credentials when file doesn't exist", async () => {
      const unlinkSpy = vi
        .spyOn(fs, "unlink")
        .mockRejectedValue(new Error("File not found"));

      await qwenAuth.clearCredentials();

      expect((qwenAuth as any).credentials).toBeNull();
      expect(unlinkSpy).toHaveBeenCalled();
    });

    it("should handle credential file read errors gracefully", async () => {
      // Mock file read error
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("Permission denied"));

      // Should start device flow when unable to read credentials
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });

    it("should handle invalid JSON in credential file", async () => {
      // Mock invalid JSON in credential file
      vi.spyOn(fs, "readFile").mockResolvedValue("invalid json content");

      // Should start device flow when unable to parse credentials
      const mockStartDeviceFlow = vi
        .spyOn(qwenAuth as any, "startDeviceFlow")
        .mockResolvedValue(true);

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(mockStartDeviceFlow).toHaveBeenCalled();
    });
  });

  describe("Token Management", () => {
    it("should return correct resource URL", async () => {
      // Mock existing credentials file
      const mockCredentials = {
        access_token: "cached-access-token",
        refresh_token: "cached-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000, // 1 hour in future
        resource_url: `${serverUrl}/api/v2`
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      await qwenAuth.authenticate();

      const resourceUrl = qwenAuth.getResourceUrl();
      expect(resourceUrl).toBe(`${serverUrl}/api/v2`);
    });

    it("should return null resource URL when not set", async () => {
      // Mock credentials without resource_url
      const mockCredentials = {
        access_token: "cached-access-token",
        refresh_token: "cached-refresh-token",
        token_type: "Bearer",
        expiry_date: Date.now() + 3600000 // 1 hour in future
        // No resource_url
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      await qwenAuth.authenticate();

      const resourceUrl = qwenAuth.getResourceUrl();
      expect(resourceUrl).toBeNull();
    });

    it("should handle token with no expiry date", async () => {
      // Mock credentials without expiry_date
      const mockCredentials = {
        access_token: "cached-access-token",
        refresh_token: "cached-refresh-token",
        token_type: "Bearer"
        // No expiry_date
      };

      vi.spyOn(fs, "readFile").mockResolvedValue(JSON.stringify(mockCredentials));

      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);

      // Verify we can get the access token
      const token = await qwenAuth.getAccessToken();
      expect(token).toBe("cached-access-token");
    });
  });

  describe("Event Handling", () => {
    it("should emit all expected events during authentication", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      const authSuccessSpy = vi.fn();
      const authFailureSpy = vi.fn();
      const authUriSpy = vi.fn();
      const tokenRefreshedSpy = vi.fn();

      // Listen for all events
      qwenAuth["qwenAuthEvents"].on(QwenAuthEventType.AuthSuccess, authSuccessSpy);
      qwenAuth["qwenAuthEvents"].on(QwenAuthEventType.AuthFailure, authFailureSpy);
      qwenAuth["qwenAuthEvents"].on(QwenAuthEvent.AuthUri, authUriSpy);
      qwenAuth["qwenAuthEvents"].on(
        QwenAuthEventType.TokenRefreshed,
        tokenRefreshedSpy
      );

      // Run the authentication
      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
      expect(authSuccessSpy).toHaveBeenCalled();
      expect(authUriSpy).toHaveBeenCalled();
      // AuthFailure and TokenRefreshed should not be called in successful flow
      expect(authFailureSpy).not.toHaveBeenCalled();
      expect(tokenRefreshedSpy).not.toHaveBeenCalled();
    });

    it("should emit failure events on authentication failure", async () => {
      // Temporarily override the device code endpoint to an invalid URL
      const invalidEndpoint = `${serverUrl}/invalid/endpoint`;
      (global as any).QWEN_OAUTH_DEVICE_CODE_ENDPOINT = invalidEndpoint;

      // Mock fs to return no cached credentials
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      const authFailureSpy = vi.fn();

      // Listen for failure events
      qwenAuth["qwenAuthEvents"].on(QwenAuthEventType.AuthFailure, authFailureSpy);

      // Run the authentication
      const result = await qwenAuth.authenticate();

      expect(result).toBe(false);
      expect(authFailureSpy).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle concurrent authentication attempts", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      // Start multiple authentication attempts
      const promises = [
        qwenAuth.authenticate(),
        qwenAuth.authenticate(),
        qwenAuth.authenticate()
      ];

      const results = await Promise.all(promises);

      // All should succeed
      expect(results).toEqual([true, true, true]);
    });

    it("should handle rapid successive authentications", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      // Authenticate multiple times in succession
      const result1 = await qwenAuth.authenticate();
      const result2 = await qwenAuth.authenticate();
      const result3 = await qwenAuth.authenticate();

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it("should handle authentication after clearing credentials", async () => {
      // Mock fs operations
      vi.spyOn(fs, "readFile").mockRejectedValue(new Error("File not found"));

      // Clear credentials first
      await qwenAuth.clearCredentials();

      // Then authenticate
      const result = await qwenAuth.authenticate();

      expect(result).toBe(true);
    });
  });
});
