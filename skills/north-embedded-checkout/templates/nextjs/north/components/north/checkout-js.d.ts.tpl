// Types for North's browser library, loaded from https://checkout.north.com/checkout.js.
// It exposes a global `checkout`. Only the calls this starter uses are typed.

export {};

declare global {
  interface NorthCheckoutGlobal {
    /** Render North's hosted payment form (an iframe) into the element with this id. */
    mount(sessionToken: string, containerId: string): Promise<void>;
    /** Fires in the browser when the customer finishes. A UI hint only; verify on the server. Returns an unsubscribe function. */
    onPaymentComplete(callback: (result?: unknown) => void): () => void;
  }

  interface Window {
    checkout?: NorthCheckoutGlobal;
  }
}
