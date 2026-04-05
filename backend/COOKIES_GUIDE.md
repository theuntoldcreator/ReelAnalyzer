# Instagram Cookies for ReelAnalyzer
# ==================================

To bypass Instagram's "Login Required" or "Rate Limit" errors:

1.  **Install a browser extension**: Use "Get cookies.txt LOCALLY" (Chrome) or "Export Cookies" (Firefox).
2.  **Log in to Instagram**: Ensure you are logged into your account in your browser.
3.  **Export Cookies**: Use the extension to export cookies for `instagram.com` specifically in **Netscape** format.
4.  **Create `cookies.txt`**:
    -   Create a new file at `backend/cookies.txt` (this file may not currently exist).
    -   Paste the exported cookie content into that file.
    -   The first line of the file should be: `# Netscape HTTP Cookie File`.
5.  **Restart Backend**: Restart your server or restart the `start.sh` script to pick up the change.

> [!WARNING]
> Keep your `cookies.txt` file private. It contains your active login session.
