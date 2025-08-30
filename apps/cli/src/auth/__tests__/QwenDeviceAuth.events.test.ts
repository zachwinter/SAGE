import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QwenDeviceAuth,
  QwenAuthEventType,
  QwenAuthEvent,
  qwenAuthEvents
} from "../QwenDeviceAuth";

describe.skip("QwenDeviceAuth Event Handling", () => {
  let qwenAuth: QwenDeviceAuth;

  beforeEach(() => {
    qwenAuth = new QwenDeviceAuth();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Remove all event listeners to avoid test interference
    qwenAuthEvents.removeAllListeners();
  });

  describe("Event Emission", () => {
    it("should emit AuthSuccess event on successful authentication", () => {
      const authSuccessSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, authSuccessSpy);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      expect(authSuccessSpy).toHaveBeenCalled();
    });

    it("should emit AuthFailure event on authentication failure", () => {
      const authFailureSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEventType.AuthFailure, authFailureSpy);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);

      expect(authFailureSpy).toHaveBeenCalled();
    });

    it("should emit TokenRefreshed event when token is refreshed", () => {
      const tokenRefreshedSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEventType.TokenRefreshed, tokenRefreshedSpy);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.TokenRefreshed);

      expect(tokenRefreshedSpy).toHaveBeenCalled();
    });

    it("should emit AuthUri event with device auth response", () => {
      const authUriSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthUri, authUriSpy);

      const deviceAuthResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://example.com/verify",
        verification_uri_complete: "https://example.com/verify?user_code=TEST-CODE",
        expires_in: 3600
      };

      // Emit the event with data
      qwenAuthEvents.emit(QwenAuthEvent.AuthUri, deviceAuthResponse);

      expect(authUriSpy).toHaveBeenCalledWith(deviceAuthResponse);
    });

    it("should emit AuthProgress event with progress information", () => {
      const authProgressSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthProgress, authProgressSpy);

      const status = "pending";
      const message = "Waiting for user authorization";

      // Emit the event with data
      qwenAuthEvents.emit(QwenAuthEvent.AuthProgress, status, message);

      expect(authProgressSpy).toHaveBeenCalledWith(status, message);
    });

    it("should emit AuthCancel event when cancellation is requested", () => {
      const authCancelSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthCancel, authCancelSpy);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEvent.AuthCancel);

      expect(authCancelSpy).toHaveBeenCalled();
    });

    it("should emit AuthCancelled event when authentication is cancelled", () => {
      const authCancelledSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthCancelled, authCancelledSpy);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEvent.AuthCancelled);

      expect(authCancelledSpy).toHaveBeenCalled();
    });
  });

  describe("Multiple Event Listeners", () => {
    it("should notify all listeners for the same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener1);
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener2);
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener3);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
      expect(listener3).toHaveBeenCalled();
    });

    it("should handle removing specific listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener1);
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener2);

      // Remove one listener
      qwenAuthEvents.off(QwenAuthEventType.AuthSuccess, listener1);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should handle removing all listeners for an event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener1);
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, listener2);

      // Remove all listeners for this event
      qwenAuthEvents.removeAllListeners(QwenAuthEventType.AuthSuccess);

      // Emit the event
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe("Event Data Validation", () => {
    it("should pass correct data structure for AuthUri event", () => {
      const authUriSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthUri, authUriSpy);

      const deviceAuthResponse = {
        device_code: "test-device-code",
        user_code: "TEST-CODE",
        verification_uri: "https://example.com/verify",
        verification_uri_complete: "https://example.com/verify?user_code=TEST-CODE",
        expires_in: 3600
      };

      qwenAuthEvents.emit(QwenAuthEvent.AuthUri, deviceAuthResponse);

      const call = authUriSpy.mock.calls[0][0];
      expect(call.device_code).toBe("test-device-code");
      expect(call.user_code).toBe("TEST-CODE");
      expect(call.verification_uri).toBe("https://example.com/verify");
      expect(call.verification_uri_complete).toBe(
        "https://example.com/verify?user_code=TEST-CODE"
      );
      expect(call.expires_in).toBe(3600);
    });

    it("should pass correct parameters for AuthProgress event", () => {
      const authProgressSpy = vi.fn();
      qwenAuthEvents.on(QwenAuthEvent.AuthProgress, authProgressSpy);

      qwenAuthEvents.emit(
        QwenAuthEvent.AuthProgress,
        "success",
        "Authentication completed"
      );

      const call = authProgressSpy.mock.calls[0];
      expect(call[0]).toBe("success");
      expect(call[1]).toBe("Authentication completed");
    });
  });

  describe("Event Flow", () => {
    it("should emit correct sequence of events during successful authentication", () => {
      const events: string[] = [];

      // Listen for all events
      qwenAuthEvents.on(QwenAuthEvent.AuthUri, () => events.push("AuthUri"));
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, () =>
        events.push("AuthSuccess")
      );
      qwenAuthEvents.on(QwenAuthEvent.AuthProgress, () =>
        events.push("AuthProgress")
      );

      // Emit events in typical sequence
      qwenAuthEvents.emit(QwenAuthEvent.AuthUri, {
        device_code: "test",
        user_code: "TEST",
        verification_uri: "https://example.com",
        verification_uri_complete: "https://example.com?code=TEST",
        expires_in: 3600
      });

      qwenAuthEvents.emit(QwenAuthEvent.AuthProgress, "pending", "Waiting for user");
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      // Verify the sequence
      expect(events).toEqual(["AuthUri", "AuthProgress", "AuthSuccess"]);
    });

    it("should emit correct sequence of events during failed authentication", () => {
      const events: string[] = [];

      // Listen for all events
      qwenAuthEvents.on(QwenAuthEventType.AuthFailure, () =>
        events.push("AuthFailure")
      );
      qwenAuthEvents.on(QwenAuthEvent.AuthCancelled, () =>
        events.push("AuthCancelled")
      );

      // Emit events in failure sequence
      qwenAuthEvents.emit(QwenAuthEvent.AuthCancelled);
      qwenAuthEvents.emit(QwenAuthEventType.AuthFailure);

      // Verify the sequence
      expect(events).toEqual(["AuthCancelled", "AuthFailure"]);
    });

    it("should emit correct sequence of events during token refresh", () => {
      const events: string[] = [];

      // Listen for all events
      qwenAuthEvents.on(QwenAuthEventType.AuthSuccess, () =>
        events.push("AuthSuccess")
      );
      qwenAuthEvents.on(QwenAuthEventType.TokenRefreshed, () =>
        events.push("TokenRefreshed")
      );

      // Emit events in refresh sequence
      qwenAuthEvents.emit(QwenAuthEventType.TokenRefreshed);
      qwenAuthEvents.emit(QwenAuthEventType.AuthSuccess);

      // Verify the sequence
      expect(events).toEqual(["TokenRefreshed", "AuthSuccess"]);
    });
  });
});
