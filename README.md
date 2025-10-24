# Cloudflare Custom WAF Rule Provisioner

A Cloudflare Worker that provides a user-friendly web interface to manage custom WAF (Web Application Firewall) rules for your Cloudflare zones. Add and delete rules with ease through an intuitive tabbed interface.

## Features

### Add Rules
- **Web-based UI**: Simple, beautiful interface for adding WAF rules
- **Flexible Token Options**: Use secret (production) or paste token (testing)
- **Multi-Zone Support**: Add the same rules to multiple zones at once
- **Batch Processing**: Add multiple rules at once via JSON array input
- **Automatic Ruleset Discovery**: Automatically retrieves the custom ruleset ID for your zone
- **Sequential Processing**: Adds rules one at a time (as required by Cloudflare API)
- **Real-time Progress Tracking**: Visual progress updates for each zone being processed
- **Verification**: Automatically verifies rules were added successfully

### Delete Rules
- **Rule Discovery**: Load and view all existing custom WAF rules in a zone
- **Multi-Select Deletion**: Select multiple rules to delete at once
- **Confirmation Modal**: Preview rules before deletion with "cannot be undone" warning
- **Smart Selection**: Select All / Deselect All functionality
- **Live Updates**: Deleted rules disappear from the UI immediately
- **Progress Tracking**: Real-time feedback during deletion process

### General
- **Error Handling**: Comprehensive error handling with detailed feedback
- **TypeScript**: Fully typed for better development experience
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v16 or later)
- A Cloudflare account with access to WAF features
- A Cloudflare API token with the following permissions:
  - Zone.Zone Settings.Read
  - Zone.Firewall Services.Edit

## Installation

1. Clone this repository:
```bash
git clone https://github.com/disruptednetwork/cloudflare-custom-rule-provisioner.git
cd cloudflare-custom-rule-provisioner
```

2. Install dependencies:
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

After deployment, Wrangler will display your worker URL. It will typically be:
- `https://custom-rule-provision.YOUR_SUBDOMAIN.workers.dev` (if using workers.dev)
- Or your custom domain if you've configured one

## Using the Web Interface

The interface has two tabs: **Add Rules** and **Delete Rules**.

### Add Rules Tab

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

5. Click **Add WAF Rules**
6. Wait for the process to complete
7. Review the results, including verification of added rules

### Delete Rules Tab

1. Switch to the **Delete Rules** tab
2. Choose your **API Token Source** (same options as Add Rules)
3. Enter your **Zone ID** (single zone only)
4. Click **Load Rules** to fetch all existing custom WAF rules
5. Review the loaded rules - each shows:
   - Description
   - Action (block, challenge, etc.)
   - Expression
   - Rule ID
6. Select the rules you want to delete:
   - Check individual rule checkboxes
   - Or use **Select All** / **Deselect All** buttons
7. Click **Delete Selected Rules (X)** where X is the count
8. Review the confirmation modal showing:
   - Count of rules to be deleted
   - Preview of each rule
   - Warning: "This action cannot be undone"
9. Click **Delete Rules** to confirm, or **Cancel** to abort
10. Watch the deletion progress and review results

**Note**: Deleted rules are removed one at a time as required by Cloudflare's API. Successfully deleted rules disappear from the list immediately.

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

### `POST /api/list-rules`
Lists all custom WAF rules in a zone

**Request Body:**
```json
{
  "zoneId": "your-zone-id",
  "apiToken": "optional-if-using-secret"
}
```

**Response:**
```json
{
  "success": true,
  "rulesetId": "ruleset-id",
  "rules": [
    {
      "id": "rule-id",
      "action": "block",
      "description": "Rule description",
      "expression": "filter expression"
    }
  ],
  "totalRules": 1
}
```

### `POST /api/delete-rules`
Deletes multiple WAF rules from a zone

**Request Body:**
```json
{
  "zoneId": "your-zone-id",
  "rulesetId": "ruleset-id",
  "ruleIds": ["rule-id-1", "rule-id-2"],
  "apiToken": "optional-if-using-secret"
}
```

**Response:**
```json
{
  "success": true,
  "deletedCount": 2,
  "totalCount": 2
}
```

**Partial Success Response (HTTP 207):**
```json
{
  "success": false,
  "deletedCount": 1,
  "totalCount": 2,
  "errors": ["Rule rule-id-2: Failed to delete rule: 404 Not Found"]
}
```

## How It Works

### Adding Rules
1. **Get Ruleset ID**: Makes a GET request to `/zones/{zoneId}/rulesets` to find the custom firewall ruleset
2. **Add Rules**: Iterates through the rules array and makes a POST request for each rule to `/zones/{zoneId}/rulesets/{rulesetId}/rules`
3. **Verify**: Makes a GET request to `/zones/{zoneId}/rulesets/{rulesetId}` to verify the rules were added successfully

### Deleting Rules
1. **List Rules**: Makes a GET request to `/zones/{zoneId}/rulesets/{rulesetId}` to fetch all rules
2. **Display**: Shows each rule with checkbox for selection
3. **Confirm**: User reviews selected rules in confirmation modal
4. **Delete**: Iterates through selected rule IDs and makes a DELETE request for each rule to `/zones/{zoneId}/rulesets/{rulesetId}/rules/{ruleId}`
5. **Update UI**: Removes successfully deleted rules from the display

## Project Structure

```
cloudflare-custom-rule-provisioner/
├── src/
│   └── index.ts          # Main worker code
├── example-rules.json    # Sample WAF rules
├── wrangler.jsonc        # Wrangler configuration
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Development

### Type Generation

If you modify `wrangler.jsonc` (e.g., add environment variables or bindings), regenerate TypeScript types:
```bash
npm run cf-typegen
```

This updates `worker-configuration.d.ts` with the latest type definitions for your Worker environment.

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
