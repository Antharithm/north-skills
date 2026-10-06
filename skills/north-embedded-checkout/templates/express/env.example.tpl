# North Embedded Checkout - Sandbox credentials
# Find them at developer.north.com -> Checkout Designer -> your checkout.
# Server-only. Never prefix these with anything the browser can read.

# Private key: sent as `Authorization: Bearer ...` on every server -> North call,
# and the HMAC key North signs transaction webhooks with.
NORTH_CHECKOUT_PRIVATE_KEY=

# The checkout configuration you built in Checkout Designer.
NORTH_CHECKOUT_ID=

# The merchant profile the checkout belongs to.
NORTH_PROFILE_ID=
