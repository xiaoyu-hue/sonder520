# Security Policy

## Security model

- This tool is a **local personal work / life management tool**, running on the user's device by default.
- **No network, no collection, no upload of any user data**; user data stays on the local device.
- All user input is escaped / validated before entering the DOM, preventing XSS.

## Known limitations

- **No backend auth** (by design; no sensitive server side).
- Exported files are static — **anyone who gets the file can read its content**. Do not put truly private info (home address, ID numbers, passwords) in them.

## Reporting a vulnerability

File a GitHub Issue tagged `security`, or message the author privately. Do not publicly disclose details before a fix.

## Not applicable

This project involves no: server-side auth, database, third-party API calls, or cookie / token storage — hence no corresponding attack surface.
