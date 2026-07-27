# Product Context

## Problem Statement
Standard link shorteners restrict users to generic branding (e.g. `bit.ly/3x82`). Modern companies and content creators require custom branded domains (e.g. `go.orfa.dev/github` or `link.company.com/promo`) to increase click-through rates, brand trust, and domain authority.

## Target User Experience
1. **User Sign Up & API Key**: User creates an account, acquires JWT tokens, or generates a live API Key (`sl_live_...`) to automate link creation from their CLI or app.
2. **Domain Registration**: User adds custom domain `go.orfa.dev` into the system.
3. **DNS Ownership Verification**:
   - User configures a CNAME record pointing `go` to `domains.shortlink-service.com`.
   - User adds a TXT record `_shortlink-verification.go` with token `shortlink-verification=4f8d92...`.
   - User clicks "Verify" or the system periodically checks DNS records. Once TXT matches, domain becomes active.
4. **Link Shortening**: User submits long URL `https://github.com/torvalds/linux` and custom slug `github`. Short link `https://go.orfa.dev/github` is ready.
5. **Visitor Redirect**:
   - Visitor navigates to `https://go.orfa.dev/github`.
   - Server reads `Host: go.orfa.dev` and `slug: github`.
   - Visitor is immediately redirected (`302` or `301`) to `https://github.com/torvalds/linux`.
   - Click analytics (browser, OS, device, referrer) are recorded in the background.
