/**
 * Cloudflare Worker for provisioning custom WAF rules
 *
 * This worker provides a UI to add multiple custom WAF rules to a Cloudflare zone.
 * It automatically retrieves the ruleset ID and adds rules one at a time.
 */

interface Env {
	CF_API_TOKEN: string;
}

interface WAFRule {
	action: string;
	description: string;
	expression: string;
}

interface RulesetResponse {
	success: boolean;
	errors: any[];
	messages: any[];
	result: Array<{
		id: string;
		name: string;
		description: string;
		kind: string;
		phase: string;
		source: string;
		last_updated: string;
		version: string;
	}>;
}

interface AddRuleResponse {
	success: boolean;
	errors: any[];
	messages: any[];
	result?: any;
}

const HTML_FORM = `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Cloudflare Custom WAF Rule Provisioner</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			min-height: 100vh;
			padding: 20px;
		}
		.container {
			max-width: 800px;
			margin: 0 auto;
			background: white;
			border-radius: 12px;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
			padding: 40px;
		}
		h1 {
			color: #333;
			margin-bottom: 10px;
			font-size: 28px;
		}
		.subtitle {
			color: #666;
			margin-bottom: 30px;
			font-size: 14px;
		}
		label {
			display: block;
			margin-bottom: 8px;
			color: #333;
			font-weight: 600;
		}
		input[type="text"], input[type="password"], textarea {
			width: 100%;
			padding: 12px;
			border: 2px solid #e0e0e0;
			border-radius: 6px;
			font-size: 14px;
			font-family: inherit;
			transition: border-color 0.3s;
		}
		input[type="text"]:focus, input[type="password"]:focus, textarea:focus {
			outline: none;
			border-color: #667eea;
		}
		input[type="password"] {
			font-family: monospace;
		}
		.radio-group {
			display: flex;
			gap: 20px;
			margin-bottom: 12px;
		}
		.radio-option {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.radio-option input[type="radio"] {
			width: auto;
			cursor: pointer;
		}
		.radio-option label {
			margin: 0;
			font-weight: normal;
			cursor: pointer;
		}
		.token-input-group {
			display: none;
		}
		.token-input-group.active {
			display: block;
		}
		.warning {
			background-color: #fff3cd;
			border: 1px solid #ffc107;
			color: #856404;
			padding: 12px;
			border-radius: 6px;
			margin-top: 8px;
			font-size: 13px;
		}
		textarea {
			font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
			resize: vertical;
			min-height: 200px;
		}
		.form-group {
			margin-bottom: 24px;
		}
		button {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: white;
			padding: 14px 32px;
			border: none;
			border-radius: 6px;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: transform 0.2s, box-shadow 0.2s;
			width: 100%;
		}
		button:hover {
			transform: translateY(-2px);
			box-shadow: 0 10px 20px rgba(0,0,0,0.2);
		}
		button:active {
			transform: translateY(0);
		}
		button:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
		#progress {
			margin-top: 24px;
			display: none;
		}
		#result {
			margin-top: 24px;
			padding: 16px;
			border-radius: 6px;
			display: none;
		}
		.zone-progress {
			margin-bottom: 16px;
			padding: 12px;
			border-radius: 6px;
			border: 1px solid #dee2e6;
			background: #f8f9fa;
		}
		.zone-progress h3 {
			margin: 0 0 8px 0;
			font-size: 14px;
			color: #333;
		}
		.zone-progress .status {
			font-size: 13px;
			margin-top: 4px;
		}
		.zone-progress.processing {
			border-color: #bee5eb;
			background-color: #d1ecf1;
		}
		.zone-progress.success {
			border-color: #c3e6cb;
			background-color: #d4edda;
		}
		.zone-progress.error {
			border-color: #f5c6cb;
			background-color: #f8d7da;
		}
		.success {
			background-color: #d4edda;
			border: 1px solid #c3e6cb;
			color: #155724;
		}
		.error {
			background-color: #f8d7da;
			border: 1px solid #f5c6cb;
			color: #721c24;
		}
		.info {
			background-color: #d1ecf1;
			border: 1px solid #bee5eb;
			color: #0c5460;
		}
		.code {
			background: #f5f5f5;
			padding: 12px;
			border-radius: 4px;
			margin-top: 12px;
			font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
			font-size: 12px;
			overflow-x: auto;
			white-space: pre-wrap;
			word-wrap: break-word;
		}
		.example {
			background: #f8f9fa;
			padding: 12px;
			border-radius: 4px;
			margin-top: 8px;
			font-size: 12px;
			border-left: 4px solid #667eea;
		}
		.spinner {
			border: 3px solid #f3f3f3;
			border-top: 3px solid #667eea;
			border-radius: 50%;
			width: 20px;
			height: 20px;
			animation: spin 1s linear infinite;
			display: inline-block;
			margin-right: 10px;
		}
		@keyframes spin {
			0% { transform: rotate(0deg); }
			100% { transform: rotate(360deg); }
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Cloudflare Custom WAF Rule Provisioner</h1>
		<p class="subtitle">Add multiple custom WAF rules to your Cloudflare zone</p>

		<form id="ruleForm">
			<div class="form-group">
				<label>API Token Source *</label>
				<div class="radio-group">
					<div class="radio-option">
						<input type="radio" id="tokenSourceSecret" name="tokenSource" value="secret" checked>
						<label for="tokenSourceSecret">Use Secret (Configured via Wrangler)</label>
					</div>
					<div class="radio-option">
						<input type="radio" id="tokenSourcePaste" name="tokenSource" value="paste">
						<label for="tokenSourcePaste">Paste API Token</label>
					</div>
				</div>
				<div class="token-input-group" id="pastedTokenGroup">
					<input type="password" id="pastedToken" name="pastedToken"
						placeholder="Paste your Cloudflare API token here">
					<div class="example">
						<strong>Note:</strong> Token will only be used for this request and not stored.
					</div>
				</div>
			</div>

			<div class="form-group">
				<label for="zoneIds">Zone IDs (one per line) *</label>
				<textarea id="zoneIds" name="zoneIds" required style="min-height: 100px;"
					placeholder="Enter one or more Zone IDs (one per line)&#10;e.g.,&#10;023e105f4ecef8ad9ca31a8372d0c353&#10;a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"></textarea>
				<div class="example">
					<strong>Tip:</strong> Enter multiple Zone IDs (one per line) to provision the same rules across multiple zones.
				</div>
			</div>

			<div class="form-group">
				<label for="rules">WAF Rules (JSON Array) *</label>
				<textarea id="rules" name="rules" required
					placeholder='Paste your rules JSON array here...'></textarea>
				<div class="example">
					<strong>Example format:</strong><br>
					[<br>
					&nbsp;&nbsp;{<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"action": "block",<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"description": "Block low WAF score",<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"expression": "(cf.waf.score lt 20)"<br>
					&nbsp;&nbsp;},<br>
					&nbsp;&nbsp;{<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"action": "block",<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"description": "Block specific countries",<br>
					&nbsp;&nbsp;&nbsp;&nbsp;"expression": "(ip.src.country eq \\"XX\\")"<br>
					&nbsp;&nbsp;}<br>
					]
				</div>
			</div>

			<button type="submit" id="submitBtn">
				Add WAF Rules
			</button>
		</form>

		<div id="progress"></div>
		<div id="result"></div>
	</div>

	<script>
		// Handle token source toggle
		const tokenSourceRadios = document.querySelectorAll('input[name="tokenSource"]');
		const pastedTokenGroup = document.getElementById('pastedTokenGroup');

		tokenSourceRadios.forEach(radio => {
			radio.addEventListener('change', (e) => {
				if (e.target.value === 'paste') {
					pastedTokenGroup.classList.add('active');
					document.getElementById('pastedToken').required = true;
				} else {
					pastedTokenGroup.classList.remove('active');
					document.getElementById('pastedToken').required = false;
				}
			});
		});

		document.getElementById('ruleForm').addEventListener('submit', async (e) => {
			e.preventDefault();

			const submitBtn = document.getElementById('submitBtn');
			const progressDiv = document.getElementById('progress');
			const resultDiv = document.getElementById('result');
			const tokenSource = document.querySelector('input[name="tokenSource"]:checked').value;
			const pastedToken = document.getElementById('pastedToken').value.trim();
			const zoneIdsText = document.getElementById('zoneIds').value.trim();
			const rulesText = document.getElementById('rules').value.trim();

			// Validate token based on source
			if (tokenSource === 'paste' && !pastedToken) {
				resultDiv.className = 'error';
				resultDiv.style.display = 'block';
				resultDiv.innerHTML = '<strong>Error:</strong><br>Please enter your API token';
				return;
			}

			// Parse zone IDs (one per line)
			const zoneIds = zoneIdsText.split('\\n')
				.map(id => id.trim())
				.filter(id => id.length > 0);

			if (zoneIds.length === 0) {
				resultDiv.className = 'error';
				resultDiv.style.display = 'block';
				resultDiv.innerHTML = '<strong>Error:</strong><br>Please enter at least one Zone ID';
				return;
			}

			// Validate and parse rules
			let rules;
			try {
				rules = JSON.parse(rulesText);
				if (!Array.isArray(rules)) {
					throw new Error('Rules must be an array');
				}
				if (rules.length === 0) {
					throw new Error('Rules array cannot be empty');
				}
				// Validate each rule has required fields
				rules.forEach((rule, index) => {
					if (!rule.action || !rule.description || !rule.expression) {
						throw new Error(\`Rule at index \${index} is missing required fields (action, description, expression)\`);
					}
				});
			} catch (error) {
				resultDiv.className = 'error';
				resultDiv.style.display = 'block';
				resultDiv.innerHTML = '<strong>Invalid JSON:</strong><br>' + error.message;
				return;
			}

			// Disable form and show progress
			submitBtn.disabled = true;
			submitBtn.innerHTML = '<span class="spinner"></span>Processing...';
			progressDiv.style.display = 'block';
			progressDiv.innerHTML = '';
			resultDiv.style.display = 'none';

			let successCount = 0;
			let failureCount = 0;
			const results = [];

			// Process each zone sequentially
			for (let i = 0; i < zoneIds.length; i++) {
				const zoneId = zoneIds[i];
				const zoneDiv = document.createElement('div');
				zoneDiv.className = 'zone-progress processing';
				zoneDiv.id = 'zone-' + i;
				zoneDiv.innerHTML = \`
					<h3>Zone \${i + 1} of \${zoneIds.length}: \${zoneId}</h3>
					<div class="status"><span class="spinner"></span> Processing...</div>
				\`;
				progressDiv.appendChild(zoneDiv);

				try {
					const requestBody = {
						zoneId: zoneId,
						rules: rules
					};

					// Include token if using paste option
					if (tokenSource === 'paste') {
						requestBody.apiToken = pastedToken;
					}

					const response = await fetch('/api/add-rules', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify(requestBody)
					});

					const result = await response.json();

					if (response.ok && result.success) {
						zoneDiv.className = 'zone-progress success';
						zoneDiv.innerHTML = \`
							<h3>Zone \${i + 1} of \${zoneIds.length}: \${zoneId}</h3>
							<div class="status">✓ Success! Added \${result.addedRules} of \${result.totalRules} rule(s)</div>
							<div class="status">Ruleset ID: \${result.rulesetId}</div>
							<div class="status">Total rules in ruleset: \${result.verification.totalRules}</div>
						\`;
						successCount++;
						results.push({ zoneId, success: true, result });
					} else {
						throw new Error(result.error || 'Unknown error occurred');
					}
				} catch (error) {
					zoneDiv.className = 'zone-progress error';
					zoneDiv.innerHTML = \`
						<h3>Zone \${i + 1} of \${zoneIds.length}: \${zoneId}</h3>
						<div class="status">✗ Error: \${error.message}</div>
					\`;
					failureCount++;
					results.push({ zoneId, success: false, error: error.message });
				}
			}

			// Show final summary
			resultDiv.style.display = 'block';
			if (failureCount === 0) {
				resultDiv.className = 'success';
				resultDiv.innerHTML = \`
					<strong>All zones completed successfully!</strong><br>
					Total zones: \${zoneIds.length}<br>
					Successful: \${successCount}<br>
					Rules added per zone: \${rules.length}
				\`;
			} else if (successCount === 0) {
				resultDiv.className = 'error';
				resultDiv.innerHTML = \`
					<strong>All zones failed!</strong><br>
					Total zones: \${zoneIds.length}<br>
					Failed: \${failureCount}
				\`;
			} else {
				resultDiv.className = 'info';
				resultDiv.innerHTML = \`
					<strong>Completed with partial success</strong><br>
					Total zones: \${zoneIds.length}<br>
					Successful: \${successCount}<br>
					Failed: \${failureCount}
				\`;
			}

			// Re-enable form
			submitBtn.disabled = false;
			submitBtn.innerHTML = 'Add WAF Rules';
		});
	</script>
</body>
</html>
`;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		// Serve HTML form on root path
		if (url.pathname === '/' && request.method === 'GET') {
			return new Response(HTML_FORM, {
				headers: {
					'Content-Type': 'text/html;charset=UTF-8',
				},
			});
		}

		// Handle API request to add rules
		if (url.pathname === '/api/add-rules' && request.method === 'POST') {
			return handleAddRules(request, env);
		}

		return new Response('Not Found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

/**
 * Main handler for adding WAF rules
 */
async function handleAddRules(request: Request, env: Env): Promise<Response> {
	try {
		// Parse request body
		const body = await request.json() as { zoneId: string; rules: WAFRule[]; apiToken?: string };
		const { zoneId, rules, apiToken } = body;

		// Determine which token to use
		let token: string;
		if (apiToken) {
			// Use token from request body (pasted token)
			token = apiToken;
		} else if (env.CF_API_TOKEN) {
			// Use token from secret
			token = env.CF_API_TOKEN;
		} else {
			// No token available
			return jsonResponse({
				success: false,
				error: 'API token is required. Either paste your token in the UI or configure CF_API_TOKEN secret using: wrangler secret put CF_API_TOKEN'
			}, 400);
		}

		if (!zoneId || !rules || !Array.isArray(rules) || rules.length === 0) {
			return jsonResponse({
				success: false,
				error: 'Invalid request: zoneId and rules array are required'
			}, 400);
		}

		// Step 1: Get the custom ruleset ID
		const rulesetId = await getCustomRulesetId(zoneId, token);

		// Step 2: Add each rule one at a time
		let addedCount = 0;
		const errors: string[] = [];

		for (let i = 0; i < rules.length; i++) {
			try {
				await addSingleRule(zoneId, rulesetId, rules[i], token);
				addedCount++;
			} catch (error) {
				const errorMsg = `Rule ${i + 1} (${rules[i].description}): ${error instanceof Error ? error.message : 'Unknown error'}`;
				errors.push(errorMsg);
			}
		}

		// Step 3: Verify the rules were added
		const verification = await verifyRules(zoneId, rulesetId, token);

		// Return results
		if (addedCount === rules.length) {
			return jsonResponse({
				success: true,
				rulesetId,
				addedRules: addedCount,
				totalRules: rules.length,
				verification,
			});
		} else {
			return jsonResponse({
				success: false,
				rulesetId,
				addedRules: addedCount,
				totalRules: rules.length,
				errors,
				verification,
			}, 207); // Multi-Status
		}

	} catch (error) {
		console.error('Error in handleAddRules:', error);
		return jsonResponse({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		}, 500);
	}
}

/**
 * Get the custom ruleset ID for a zone
 */
async function getCustomRulesetId(zoneId: string, apiToken: string): Promise<string> {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to get rulesets: ${response.status} ${errorText}`);
	}

	const data = await response.json() as RulesetResponse;

	if (!data.success) {
		throw new Error(`API returned success=false: ${JSON.stringify(data.errors)}`);
	}

	// Find the custom firewall ruleset
	const customRuleset = data.result.find(
		ruleset => ruleset.phase === 'http_request_firewall_custom'
	);

	if (!customRuleset) {
		throw new Error('Custom firewall ruleset not found. Make sure the zone has WAF enabled.');
	}

	return customRuleset.id;
}

/**
 * Add a single WAF rule to a ruleset
 */
async function addSingleRule(
	zoneId: string,
	rulesetId: string,
	rule: WAFRule,
	apiToken: string
): Promise<void> {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules`;

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(rule),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to add rule: ${response.status} ${errorText}`);
	}

	const data = await response.json() as AddRuleResponse;

	if (!data.success) {
		throw new Error(`API returned success=false: ${JSON.stringify(data.errors)}`);
	}
}

/**
 * Verify rules were added successfully by getting the ruleset
 */
async function verifyRules(
	zoneId: string,
	rulesetId: string,
	apiToken: string
): Promise<any> {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}`;

	const response = await fetch(url, {
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		return { error: `Failed to verify: ${response.status}` };
	}

	const data = await response.json() as any;

	if (!data.success) {
		return { error: 'Verification failed', details: data.errors };
	}

	return {
		totalRules: data.result?.rules?.length || 0,
		rules: data.result?.rules || [],
	};
}

/**
 * Helper function to create JSON responses
 */
function jsonResponse(data: any, status: number = 200): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json',
		},
	});
}
