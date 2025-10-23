# Cloudflare Custom WAF Rule Provisioner

A Cloudflare Worker that provides a user-friendly web interface to add multiple custom WAF (Web Application Firewall) rules to a specified Cloudflare zone.

## Features

- **Web-based UI**: Simple, beautiful interface for adding WAF rules
- **Flexible Token Options**: Use secret (production) or paste token (testing)
- **Multi-Zone Support**: Add the same rules to multiple zones at once
- **Batch Processing**: Add multiple rules at once via JSON array input
- **Automatic Ruleset Discovery**: Automatically retrieves the custom ruleset ID for your zone
- **Sequential Processing**: Adds rules one at a time (as required by Cloudflare API)
- **Real-time Progress Tracking**: Visual progress updates for each zone being processed
- **Verification**: Automatically verifies rules were added successfully
- **Error Handling**: Comprehensive error handling with detailed feedback
- **TypeScript**: Fully typed for better development experience

## Prerequisites

- Node.js (v16 or later)
- A Cloudflare account with access to WAF features
- A Cloudflare API token with the following permissions:
  - Zone.Zone Settings.Read
  - Zone.Firewall Services.Edit

## Installation

1. Clone or navigate to this directory:
```bash
cd custom-rule-provision
```

2. Install dependencies (already done during project creation):
```bash
npm install
```

## Configuration

### 1. Get Your Cloudflare API Token

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Go to **My Profile** > **API Tokens**
3. Click **Create Token**
4. Use the **Edit zone WAF** template or create a custom token with:
   - Zone.Zone Settings.Read
   - Zone.Firewall Services.Edit
5. Copy the generated token

### 2. Configure the API Token

You have two options for providing your API token:

#### Option A: Use Secret (Recommended for Production)

For local development:
```bash
echo "YOUR_API_TOKEN_HERE" | npx wrangler secret put CF_API_TOKEN --env dev
```

For production deployment:
```bash
echo "YOUR_API_TOKEN_HERE" | npx wrangler secret put CF_API_TOKEN
```

**Note**: Replace `YOUR_API_TOKEN_HERE` with your actual Cloudflare API token.

#### Option B: Paste Token in UI (Convenient for Testing)

Simply paste your API token directly in the web interface when provisioning rules. The token is only used for that request and is not stored anywhere.

**Security Note**: For production use, Option A (secret) is recommended. Option B is convenient for testing or one-time use.

### 3. Get Your Zone ID

1. Log in to the [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Select your domain/zone
3. Scroll down to the **API** section on the Overview page
4. Copy the **Zone ID**

## Usage

### Local Development

Start the development server:
```bash
npm run dev
```

Then open your browser to `http://localhost:8787/`

### Deployment

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

After deployment, your worker will be available at:
`https://custom-rule-provision.YOUR_SUBDOMAIN.workers.dev`

## Using the Web Interface

1. Open the worker URL in your browser
2. Choose your **API Token Source**:
   - **Use Secret**: Uses the token configured via `wrangler secret put` (default, recommended)
   - **Paste API Token**: Enter your token directly in the UI (convenient for testing)
3. Enter your **Zone ID(s)** - one per line (supports multiple zones)
4. Paste your WAF rules as a JSON array in the following format:

```json
[
  {
    "action": "block",
    "description": "Block low WAF score",
    "expression": "(cf.waf.score lt 20)"
  },
  {
    "action": "block",
    "description": "Block specific countries",
    "expression": "(ip.src.country eq \"XX\") or (ip.src.country eq \"YY\")"
  }
]
```

4. Click **Add WAF Rules**
5. Wait for the process to complete
6. Review the results, including verification of added rules

## Rule Format

Each rule in the JSON array must have these fields:

- **action**: The action to take (e.g., `"block"`, `"challenge"`, `"js_challenge"`, `"managed_challenge"`, `"log"`)
- **description**: A human-readable description of the rule
- **expression**: The Cloudflare filter expression (see [Cloudflare's expression documentation](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/))

### Example Rules

**Block by WAF Score:**
```json
{
  "action": "block",
  "description": "Block requests with low WAF score",
  "expression": "(cf.waf.score lt 20)"
}
```

**Block by Country:**
```json
{
  "action": "block",
  "description": "Block specific countries",
  "expression": "(ip.src.country eq \"XX\") or (ip.src.country eq \"YY\")"
}
```

**Challenge suspicious user agents:**
```json
{
  "action": "managed_challenge",
  "description": "Challenge suspicious user agents",
  "expression": "(http.user_agent contains \"bot\")"
}
```

**Block specific IP ranges:**
```json
{
  "action": "block",
  "description": "Block specific IP range",
  "expression": "(ip.src in {192.0.2.0/24})"
}
```

## API Endpoints

### `GET /`
Returns the HTML web interface

### `POST /api/add-rules`
Adds WAF rules to a zone

**Request Body:**
```json
{
  "zoneId": "your-zone-id",
  "rules": [
    {
      "action": "block",
      "description": "Rule description",
      "expression": "filter expression"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "rulesetId": "ruleset-id",
  "addedRules": 2,
  "totalRules": 2,
  "verification": {
    "totalRules": 5,
    "rules": [...]
  }
}
```

## How It Works

1. **Get Ruleset ID**: Makes a GET request to `/zones/{zoneId}/rulesets` to find the custom firewall ruleset
2. **Add Rules**: Iterates through the rules array and makes a POST request for each rule to `/zones/{zoneId}/rulesets/{rulesetId}/rules`
3. **Verify**: Makes a GET request to `/zones/{zoneId}/rulesets/{rulesetId}` to verify the rules were added successfully

## Project Structure

```
custom-rule-provision/
├── src/
│   └── index.ts          # Main worker code
├── test/
│   └── index.spec.ts     # Tests
├── wrangler.jsonc        # Wrangler configuration
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## Development

### Type Generation

Regenerate TypeScript types for environment bindings:
```bash
npm run cf-typegen
```

### Testing

Run tests:
```bash
npm test
```

## Troubleshooting

### "CF_API_TOKEN secret is not configured"
Make sure you've set the secret using `wrangler secret put CF_API_TOKEN`

### "Custom firewall ruleset not found"
Ensure your zone has WAF enabled. This feature requires a paid Cloudflare plan.

### "Failed to get rulesets: 403"
Your API token doesn't have the required permissions. Create a new token with:
- Zone.Zone Settings.Read
- Zone.Firewall Services.Edit

### "Failed to add rule"
Check that your rule expression is valid. Refer to [Cloudflare's expression documentation](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/)

## Security Notes

- The API token is stored as a Cloudflare Worker secret and is never exposed to the client
- All API calls are made server-side
- Consider restricting access to this worker using Cloudflare Access if deploying to production

## Resources

- [Cloudflare WAF Custom Rules Documentation](https://developers.cloudflare.com/waf/custom-rules/)
- [Cloudflare API Documentation](https://developers.cloudflare.com/api/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Filter Expression Language](https://developers.cloudflare.com/ruleset-engine/rules-language/expressions/)

## License

MIT
