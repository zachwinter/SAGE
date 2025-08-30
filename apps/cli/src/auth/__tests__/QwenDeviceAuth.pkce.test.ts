import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QwenDeviceAuth } from "../QwenDeviceAuth";
import crypto from "crypto";

// Mock crypto
vi.mock("crypto");

describe.skip("QwenDeviceAuth PKCE Implementation", () => {
  let qwenAuth: QwenDeviceAuth;

  beforeEach(() => {
    qwenAuth = new QwenDeviceAuth();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("PKCE Code Generation", () => {
    it("should generate valid PKCE code verifier and challenge pair", () => {
      // Mock crypto functions
      const mockRandomBytes = Buffer.from("test-random-bytes-for-code-verifier");
      const mockChallenge = "test-code-challenge";

      (crypto.randomBytes as any).mockReturnValue(mockRandomBytes);
      (crypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockChallenge)
      });

      // Call the private method through reflection
      const pkcePair = (qwenAuth as any).generatePKCEPair();

      expect(pkcePair).toBeDefined();
      expect(pkcePair.code_verifier).toBeDefined();
      expect(pkcePair.code_challenge).toBeDefined();
      expect(typeof pkcePair.code_verifier).toBe("string");
      expect(typeof pkcePair.code_challenge).toBe("string");

      // Verify crypto was called correctly
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(crypto.createHash).toHaveBeenCalledWith("sha256");
    });

    it("should generate URL-safe code verifier", () => {
      // Mock crypto functions to return known values
      const mockRandomBytes = Buffer.from(
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"
      );
      const mockChallenge = "expected-challenge";

      (crypto.randomBytes as any).mockReturnValue(mockRandomBytes);
      (crypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue(mockChallenge)
      });

      const pkcePair = (qwenAuth as any).generatePKCEPair();

      // Code verifier should be URL-safe base64url encoded
      expect(pkcePair.code_verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate different code verifier and challenge", () => {
      // Mock crypto functions
      (crypto.randomBytes as any).mockReturnValue(Buffer.from("test-bytes-1"));
      (crypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("challenge-1")
      });

      const pkcePair1 = (qwenAuth as any).generatePKCEPair();

      // Mock different values
      (crypto.randomBytes as any).mockReturnValue(Buffer.from("test-bytes-2"));
      (crypto.createHash as any).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        digest: vi.fn().mockReturnValue("challenge-2")
      });

      const pkcePair2 = (qwenAuth as any).generatePKCEPair();

      // Should generate different values
      expect(pkcePair1.code_verifier).not.toBe(pkcePair2.code_verifier);
      expect(pkcePair1.code_challenge).not.toBe(pkcePair2.code_challenge);
    });

    it("should handle crypto errors gracefully", () => {
      // Mock crypto.randomBytes to throw an error
      (crypto.randomBytes as any).mockImplementation(() => {
        throw new Error("Crypto error");
      });

      expect(() => {
        (qwenAuth as any).generatePKCEPair();
      }).toThrow("Crypto error");
    });
  });

  describe("Code Challenge Verification", () => {
    it("should create correct SHA-256 hash for code challenge", () => {
      // Mock crypto functions
      const mockVerifier = "test-code-verifier";
      const expectedChallenge = "expected-sha256-hash";

      (crypto.randomBytes as any).mockReturnValue(Buffer.from(mockVerifier));
      const mockHash = {
        update: vi.fn(),
        digest: vi.fn().mockReturnValue(expectedChallenge)
      };
      (crypto.createHash as any).mockReturnValue(mockHash);

      const pkcePair = (qwenAuth as any).generatePKCEPair();

      // Verify the hash was computed correctly
      expect(mockHash.update).toHaveBeenCalledWith(mockVerifier);
      expect(mockHash.digest).toHaveBeenCalledWith("base64url");
      expect(pkcePair.code_challenge).toBe(expectedChallenge);
    });

    it("should handle empty code verifier", () => {
      // Mock crypto functions
      const mockVerifier = "";
      const expectedChallenge = "47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU"; // SHA-256 of empty string in base64url

      (crypto.randomBytes as any).mockReturnValue(Buffer.from(mockVerifier));
      const mockHash = {
        update: vi.fn(),
        digest: vi.fn().mockReturnValue(expectedChallenge)
      };
      (crypto.createHash as any).mockReturnValue(mockHash);

      const pkcePair = (qwenAuth as any).generatePKCEPair();

      expect(mockHash.update).toHaveBeenCalledWith(mockVerifier);
      expect(pkcePair.code_challenge).toBe(expectedChallenge);
    });
  });
});
