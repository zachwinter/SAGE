import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QwenDeviceAuth } from "../QwenDeviceAuth";

describe.skip("QwenDeviceAuth Utility Functions", () => {
  let qwenAuth: QwenDeviceAuth;

  beforeEach(() => {
    qwenAuth = new QwenDeviceAuth();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("objectToUrlEncoded", () => {
    it("should convert simple object to URL-encoded string", () => {
      const data = {
        key1: "value1",
        key2: "value2"
      };

      // Call the private method through reflection
      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe("key1=value1&key2=value2");
    });

    it("should handle special characters in keys and values", () => {
      const data = {
        "key with spaces": "value with spaces",
        "key+with+plus": "value+with+plus",
        "key%with%percent": "value%with%percent"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe(
        "key%20with%20spaces=value%20with%20spaces&" +
          "key%2Bwith%2Bplus=value%2Bwith%2Bplus&" +
          "key%25with%25percent=value%25with%25percent"
      );
    });

    it("should handle empty object", () => {
      const data = {};

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe("");
    });

    it("should handle single key-value pair", () => {
      const data = {
        single: "value"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe("single=value");
    });

    it("should handle numeric values", () => {
      const data = {
        numKey: 123,
        zero: 0
      };

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe("numKey=123&zero=0");
    });

    it("should handle boolean values", () => {
      const data = {
        trueKey: true,
        falseKey: false
      };

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe("trueKey=true&falseKey=false");
    });

    it("should handle special URL characters", () => {
      const data = {
        "key&with&ampersand": "value&with&ampersand",
        "key=with=equals": "value=with=equals",
        "key?with?question": "value?with?question"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(data);

      expect(result).toBe(
        "key%26with%26ampersand=value%26with%26ampersand&" +
          "key%3Dwith%3Dequals=value%3Dwith%3Dequals&" +
          "key%3Fwith%3Fquestion=value%3Fwith%3Fquestion"
      );
    });
  });

  describe("Utility Function Integration", () => {
    it("should correctly encode data for OAuth requests", () => {
      const oauthData = {
        client_id: "test-client-id",
        scope: "openid profile email model.completion",
        code_challenge: "test-code-challenge",
        code_challenge_method: "S256"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(oauthData);

      // Verify all required OAuth parameters are correctly encoded
      expect(result).toContain("client_id=test-client-id");
      expect(result).toContain("scope=openid%20profile%20email%20model.completion");
      expect(result).toContain("code_challenge=test-code-challenge");
      expect(result).toContain("code_challenge_method=S256");
    });

    it("should handle token request data encoding", () => {
      const tokenData = {
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        client_id: "test-client-id",
        device_code: "test-device-code",
        code_verifier: "test-code-verifier"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(tokenData);

      // Verify all required token request parameters are correctly encoded
      expect(result).toContain(
        "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Adevice_code"
      );
      expect(result).toContain("client_id=test-client-id");
      expect(result).toContain("device_code=test-device-code");
      expect(result).toContain("code_verifier=test-code-verifier");
    });

    it("should handle refresh token request data encoding", () => {
      const refreshTokenData = {
        grant_type: "refresh_token",
        client_id: "test-client-id",
        refresh_token: "test-refresh-token"
      };

      const result = (qwenAuth as any).objectToUrlEncoded(refreshTokenData);

      // Verify all required refresh token request parameters are correctly encoded
      expect(result).toContain("grant_type=refresh_token");
      expect(result).toContain("client_id=test-client-id");
      expect(result).toContain("refresh_token=test-refresh-token");
    });
  });
});
