# Security

Do not commit API keys, access tokens, account IDs, private media, generated work folders, or exported videos.

If you add a publishing integration, read credentials only from environment variables and keep `.env` files untracked. Rotate any credential immediately if it is committed, even when the commit is later deleted.

To report a security issue, open a GitHub issue that describes the affected file and behavior without including the secret itself.
