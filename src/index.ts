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
		.tabs {
			display: flex;
			gap: 8px;
			margin-bottom: 30px;
			border-bottom: 2px solid #e0e0e0;
		}
		.tab {
			padding: 12px 24px;
			background: none;
			border: none;
			border-bottom: 3px solid transparent;
			color: #666;
			font-size: 16px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.3s;
			width: auto;
		}
		.tab:hover {
			color: #667eea;
			transform: none;
			box-shadow: none;
		}
		.tab.active {
			color: #667eea;
			border-bottom-color: #667eea;
		}
		.tab-content {
			display: none;
		}
		.tab-content.active {
			display: block;
		}
		.rule-item {
			background: #f8f9fa;
			border: 2px solid #dee2e6;
			border-radius: 6px;
			padding: 16px;
			margin-bottom: 12px;
			display: flex;
			align-items: flex-start;
			gap: 12px;
			transition: all 0.3s;
		}
		.rule-item:hover {
			border-color: #667eea;
			background: #f0f2ff;
		}
		.rule-item input[type="checkbox"] {
			width: 20px;
			height: 20px;
			cursor: pointer;
			margin-top: 2px;
			flex-shrink: 0;
		}
		.rule-item-content {
			flex: 1;
		}
		.rule-item-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 8px;
		}
		.rule-item-description {
			font-weight: 600;
			color: #333;
			font-size: 14px;
		}
		.rule-item-action {
			background: #667eea;
			color: white;
			padding: 4px 12px;
			border-radius: 4px;
			font-size: 12px;
			font-weight: 600;
		}
		.rule-item-expression {
			font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
			font-size: 12px;
			color: #666;
			background: white;
			padding: 8px;
			border-radius: 4px;
			margin-top: 8px;
			word-break: break-all;
		}
		.rule-item-id {
			font-size: 11px;
			color: #999;
			margin-top: 4px;
		}
		.modal {
			display: none;
			position: fixed;
			z-index: 1000;
			left: 0;
			top: 0;
			width: 100%;
			height: 100%;
			background-color: rgba(0,0,0,0.5);
			animation: fadeIn 0.3s;
		}
		.modal.active {
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.modal-content {
			background: white;
			padding: 32px;
			border-radius: 12px;
			max-width: 500px;
			width: 90%;
			box-shadow: 0 20px 60px rgba(0,0,0,0.3);
			animation: slideUp 0.3s;
		}
		.modal-header {
			font-size: 20px;
			font-weight: 600;
			color: #333;
			margin-bottom: 16px;
		}
		.modal-body {
			color: #666;
			margin-bottom: 24px;
			line-height: 1.6;
		}
		.modal-buttons {
			display: flex;
			gap: 12px;
			justify-content: flex-end;
		}
		.modal-buttons button {
			width: auto;
			padding: 12px 24px;
		}
		.btn-cancel {
			background: #6c757d;
		}
		.btn-cancel:hover {
			background: #5a6268;
		}
		.btn-danger {
			background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
		}
		.btn-danger:hover {
			background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
		}
		@keyframes fadeIn {
			from { opacity: 0; }
			to { opacity: 1; }
		}
		@keyframes slideUp {
			from { transform: translateY(20px); opacity: 0; }
			to { transform: translateY(0); opacity: 1; }
		}
	</style>
</head>
<body>
	<div class="container">
		<h1>Cloudflare Custom WAF Rule Provisioner</h1>
		<p class="subtitle">Manage custom WAF rules for your Cloudflare zones</p>

		<!-- Tab Navigation -->
		<div class="tabs">
			<button type="button" class="tab active" data-tab="add-rules">Add Rules</button>
			<button type="button" class="tab" data-tab="delete-rules">Delete Rules</button>
		</div>

		<!-- Add Rules Tab -->
		<div id="add-rules-tab" class="tab-content active">
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
		<!-- End Add Rules Tab -->

		<!-- Delete Rules Tab -->
		<div id="delete-rules-tab" class="tab-content">
			<form id="deleteRuleForm">
				<div class="form-group">
					<label>API Token Source *</label>
					<div class="radio-group">
						<div class="radio-option">
							<input type="radio" id="deleteTokenSourceSecret" name="deleteTokenSource" value="secret" checked>
							<label for="deleteTokenSourceSecret">Use Secret (Configured via Wrangler)</label>
						</div>
						<div class="radio-option">
							<input type="radio" id="deleteTokenSourcePaste" name="deleteTokenSource" value="paste">
							<label for="deleteTokenSourcePaste">Paste API Token</label>
						</div>
					</div>
					<div class="token-input-group" id="deletePastedTokenGroup">
						<input type="password" id="deletePastedToken" name="deletePastedToken"
							placeholder="Paste your Cloudflare API token here">
						<div class="example">
							<strong>Note:</strong> Token will only be used for this request and not stored.
						</div>
					</div>
				</div>

				<div class="form-group">
					<label for="deleteZoneId">Zone ID *</label>
					<input type="text" id="deleteZoneId" name="deleteZoneId" required
						placeholder="e.g., 023e105f4ecef8ad9ca31a8372d0c353">
					<div class="example">
						<strong>Tip:</strong> Find your Zone ID in the Cloudflare Dashboard under your domain's Overview tab.
					</div>
				</div>

				<button type="submit" id="loadRulesBtn">
					Load Rules
				</button>
			</form>

			<div id="deleteProgress"></div>
			<div id="deleteResult"></div>
			<div id="rulesContainer" style="display: none; margin-top: 24px;">
				<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
					<h3 style="margin: 0; color: #333;">Available Rules</h3>
					<div>
						<button type="button" id="selectAllBtn" style="width: auto; padding: 8px 16px; font-size: 14px; margin-right: 8px;">Select All</button>
						<button type="button" id="deselectAllBtn" style="width: auto; padding: 8px 16px; font-size: 14px;">Deselect All</button>
					</div>
				</div>
				<div id="rulesList"></div>
				<button type="button" id="deleteSelectedBtn" style="margin-top: 16px;" disabled>
					Delete Selected Rules
				</button>
			</div>
		</div>
		<!-- End Delete Rules Tab -->

	</div>

	<!-- Confirmation Modal -->
	<div id="confirmModal" class="modal">
		<div class="modal-content">
			<div class="modal-header">Confirm Deletion</div>
			<div class="modal-body" id="modalBody"></div>
			<div class="modal-buttons">
				<button type="button" class="btn-cancel" id="cancelDeleteBtn">Cancel</button>
				<button type="button" class="btn-danger" id="confirmDeleteBtn">Delete Rules</button>
			</div>
		</div>
	</div>

	<script>
		// Tab switching functionality
		document.querySelectorAll('.tab').forEach(tab => {
			tab.addEventListener('click', () => {
				const targetTab = tab.getAttribute('data-tab');

				// Remove active class from all tabs and contents
				document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
				document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

				// Add active class to clicked tab and corresponding content
				tab.classList.add('active');
				document.getElementById(targetTab + '-tab').classList.add('active');
			});
		});


		// Handle token source toggle for Add Rules tab
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

		// Handle token source toggle for Delete Rules tab
		const deleteTokenSourceRadios = document.querySelectorAll('input[name="deleteTokenSource"]');
		const deletePastedTokenGroup = document.getElementById('deletePastedTokenGroup');

		deleteTokenSourceRadios.forEach(radio => {
			radio.addEventListener('change', (e) => {
				if (e.target.value === 'paste') {
					deletePastedTokenGroup.classList.add('active');
					document.getElementById('deletePastedToken').required = true;
				} else {
					deletePastedTokenGroup.classList.remove('active');
					document.getElementById('deletePastedToken').required = false;
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

		// Handle Load Rules form submission
		let loadedRules = [];
		let loadedRulesetId = '';
		let loadedZoneId = '';
		let loadedToken = '';

		document.getElementById('deleteRuleForm').addEventListener('submit', async (e) => {
			e.preventDefault();

			const loadRulesBtn = document.getElementById('loadRulesBtn');
			const deleteResult = document.getElementById('deleteResult');
			const rulesContainer = document.getElementById('rulesContainer');
			const rulesList = document.getElementById('rulesList');
			const deleteTokenSource = document.querySelector('input[name="deleteTokenSource"]:checked').value;
			const deletePastedToken = document.getElementById('deletePastedToken').value.trim();
			const deleteZoneId = document.getElementById('deleteZoneId').value.trim();

			// Validate token based on source
			if (deleteTokenSource === 'paste' && !deletePastedToken) {
				deleteResult.className = 'error';
				deleteResult.style.display = 'block';
				deleteResult.innerHTML = '<strong>Error:</strong><br>Please enter your API token';
				return;
			}

			if (!deleteZoneId) {
				deleteResult.className = 'error';
				deleteResult.style.display = 'block';
				deleteResult.innerHTML = '<strong>Error:</strong><br>Please enter a Zone ID';
				return;
			}

			// Store for later use in deletion
			loadedZoneId = deleteZoneId;
			loadedToken = deleteTokenSource === 'paste' ? deletePastedToken : '';

			// Disable button and show loading
			loadRulesBtn.disabled = true;
			loadRulesBtn.innerHTML = '<span class="spinner"></span>Loading Rules...';
			deleteResult.style.display = 'none';
			rulesContainer.style.display = 'none';

			try {
				const requestBody = {
					zoneId: deleteZoneId
				};

				// Include token if using paste option
				if (deleteTokenSource === 'paste') {
					requestBody.apiToken = deletePastedToken;
				}

				const response = await fetch('/api/list-rules', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody)
				});

				const result = await response.json();

				if (response.ok && result.success) {
					loadedRules = result.rules || [];
					loadedRulesetId = result.rulesetId;

					if (loadedRules.length === 0) {
						deleteResult.className = 'info';
						deleteResult.style.display = 'block';
						deleteResult.innerHTML = '<strong>No rules found</strong><br>This zone has no custom WAF rules.';
						rulesContainer.style.display = 'none';
					} else {
						// Display rules
						rulesList.innerHTML = loadedRules.map((rule, index) => \`
							<div class="rule-item">
								<input type="checkbox" id="rule-\${index}" data-rule-id="\${rule.id}" class="rule-checkbox">
								<div class="rule-item-content">
									<div class="rule-item-header">
										<label for="rule-\${index}" class="rule-item-description">\${rule.description || 'No description'}</label>
										<span class="rule-item-action">\${rule.action}</span>
									</div>
									<div class="rule-item-expression">\${rule.expression}</div>
									<div class="rule-item-id">ID: \${rule.id}</div>
								</div>
							</div>
						\`).join('');

						rulesContainer.style.display = 'block';
						deleteResult.className = 'success';
						deleteResult.style.display = 'block';
						deleteResult.innerHTML = \`<strong>Success!</strong><br>Loaded \${loadedRules.length} rule(s)\`;

						// Update delete button state
						updateDeleteButtonState();
					}
				} else {
					throw new Error(result.error || 'Unknown error occurred');
				}
			} catch (error) {
				deleteResult.className = 'error';
				deleteResult.style.display = 'block';
				deleteResult.innerHTML = '<strong>Error:</strong><br>' + error.message;
				rulesContainer.style.display = 'none';
			}

			// Re-enable button
			loadRulesBtn.disabled = false;
			loadRulesBtn.innerHTML = 'Load Rules';
		});

		// Handle Select All button
		document.getElementById('selectAllBtn').addEventListener('click', () => {
			document.querySelectorAll('.rule-checkbox').forEach(cb => cb.checked = true);
			updateDeleteButtonState();
		});

		// Handle Deselect All button
		document.getElementById('deselectAllBtn').addEventListener('click', () => {
			document.querySelectorAll('.rule-checkbox').forEach(cb => cb.checked = false);
			updateDeleteButtonState();
		});

		// Update delete button state when checkboxes change
		document.addEventListener('change', (e) => {
			if (e.target.classList.contains('rule-checkbox')) {
				updateDeleteButtonState();
			}
		});

		function updateDeleteButtonState() {
			const deleteBtn = document.getElementById('deleteSelectedBtn');
			const checkedCount = document.querySelectorAll('.rule-checkbox:checked').length;
			deleteBtn.disabled = checkedCount === 0;
			deleteBtn.textContent = checkedCount > 0 ? \`Delete Selected Rules (\${checkedCount})\` : 'Delete Selected Rules';
		}

		// Handle Delete Selected button click - show confirmation
		document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
			const selectedCheckboxes = document.querySelectorAll('.rule-checkbox:checked');
			const selectedRules = Array.from(selectedCheckboxes).map(cb => {
				const ruleId = cb.getAttribute('data-rule-id');
				const rule = loadedRules.find(r => r.id === ruleId);
				return rule;
			});

			if (selectedRules.length === 0) return;

			// Show confirmation modal
			const modalBody = document.getElementById('modalBody');
			modalBody.innerHTML = \`
				<p>Are you sure you want to delete <strong>\${selectedRules.length}</strong> rule(s)?</p>
				<div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 12px; max-height: 200px; overflow-y: auto;">
					\${selectedRules.map(rule => \`
						<div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #dee2e6;">
							<strong>\${rule.description || 'No description'}</strong><br>
							<small style="color: #666;">\${rule.expression}</small>
						</div>
					\`).join('')}
				</div>
				<p style="margin-top: 12px; color: #dc3545; font-weight: 600;">This action cannot be undone.</p>
			\`;

			document.getElementById('confirmModal').classList.add('active');
		});

		// Handle modal cancel
		document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
			document.getElementById('confirmModal').classList.remove('active');
		});

		// Handle modal confirm - perform deletion
		document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
			document.getElementById('confirmModal').classList.remove('active');

			const selectedCheckboxes = document.querySelectorAll('.rule-checkbox:checked');
			const selectedRuleIds = Array.from(selectedCheckboxes).map(cb => cb.getAttribute('data-rule-id'));

			if (selectedRuleIds.length === 0) return;

			const deleteProgress = document.getElementById('deleteProgress');
			const deleteResult = document.getElementById('deleteResult');
			const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
			const rulesContainer = document.getElementById('rulesContainer');

			// Disable UI
			deleteSelectedBtn.disabled = true;
			deleteResult.style.display = 'none';
			deleteProgress.style.display = 'block';
			deleteProgress.innerHTML = '<div class="info" style="display: block;"><span class="spinner"></span> Deleting rules...</div>';

			try {
				const deleteTokenSource = document.querySelector('input[name="deleteTokenSource"]:checked').value;
				const requestBody = {
					zoneId: loadedZoneId,
					rulesetId: loadedRulesetId,
					ruleIds: selectedRuleIds
				};

				// Include token if using paste option
				if (deleteTokenSource === 'paste') {
					requestBody.apiToken = loadedToken;
				}

				const response = await fetch('/api/delete-rules', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(requestBody)
				});

				const result = await response.json();

				deleteProgress.innerHTML = '';

				if (result.success) {
					deleteResult.className = 'success';
					deleteResult.style.display = 'block';
					deleteResult.innerHTML = \`
						<strong>Success!</strong><br>
						Deleted \${result.deletedCount} of \${result.totalCount} rule(s)
					\`;

					// Remove deleted rules from the display
					selectedRuleIds.forEach(ruleId => {
						const checkbox = document.querySelector(\`[data-rule-id="\${ruleId}"]\`);
						if (checkbox) {
							checkbox.closest('.rule-item').remove();
						}
					});

					// Update loaded rules
					loadedRules = loadedRules.filter(rule => !selectedRuleIds.includes(rule.id));

					// Hide container if no rules left
					if (loadedRules.length === 0) {
						rulesContainer.style.display = 'none';
						deleteResult.innerHTML += '<br>No rules remaining in this zone.';
					}
				} else {
					// Partial or complete failure
					deleteResult.className = result.deletedCount > 0 ? 'info' : 'error';
					deleteResult.style.display = 'block';
					deleteResult.innerHTML = \`
						<strong>\${result.deletedCount > 0 ? 'Partial Success' : 'Error'}</strong><br>
						Deleted \${result.deletedCount} of \${result.totalCount} rule(s)<br>
						\${result.errors ? '<br><strong>Errors:</strong><br>' + result.errors.join('<br>') : ''}
					\`;

					// Remove successfully deleted rules from display
					if (result.deletedCount > 0) {
						// Refresh the rules list to show current state
						document.getElementById('deleteRuleForm').dispatchEvent(new Event('submit'));
					}
				}
			} catch (error) {
				deleteProgress.innerHTML = '';
				deleteResult.className = 'error';
				deleteResult.style.display = 'block';
				deleteResult.innerHTML = '<strong>Error:</strong><br>' + error.message;
			}

			updateDeleteButtonState();
		});

		// Close modal when clicking outside
		document.getElementById('confirmModal').addEventListener('click', (e) => {
			if (e.target.id === 'confirmModal') {
				document.getElementById('confirmModal').classList.remove('active');
			}
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

		// Handle API request to list rules
		if (url.pathname === '/api/list-rules' && request.method === 'POST') {
			return handleListRules(request, env);
		}

		// Handle API request to delete rules
		if (url.pathname === '/api/delete-rules' && request.method === 'POST') {
			return handleDeleteRules(request, env);
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
 * Main handler for listing WAF rules
 */
async function handleListRules(request: Request, env: Env): Promise<Response> {
	try {
		// Parse request body
		const body = await request.json() as { zoneId: string; apiToken?: string };
		const { zoneId, apiToken } = body;

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

		if (!zoneId) {
			return jsonResponse({
				success: false,
				error: 'Invalid request: zoneId is required'
			}, 400);
		}

		// Step 1: Get the custom ruleset ID
		const rulesetId = await getCustomRulesetId(zoneId, token);

		// Step 2: Get the ruleset details (includes all rules)
		const rulesetDetails = await getRulesetDetails(zoneId, rulesetId, token);

		return jsonResponse({
			success: true,
			rulesetId,
			rules: rulesetDetails.rules || [],
			totalRules: rulesetDetails.rules?.length || 0,
		});

	} catch (error) {
		console.error('Error in handleListRules:', error);
		return jsonResponse({
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred'
		}, 500);
	}
}

/**
 * Main handler for deleting WAF rules
 */
async function handleDeleteRules(request: Request, env: Env): Promise<Response> {
	try {
		// Parse request body
		const body = await request.json() as { zoneId: string; rulesetId: string; ruleIds: string[]; apiToken?: string };
		const { zoneId, rulesetId, ruleIds, apiToken } = body;

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

		if (!zoneId || !rulesetId || !ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
			return jsonResponse({
				success: false,
				error: 'Invalid request: zoneId, rulesetId, and ruleIds array are required'
			}, 400);
		}

		// Delete each rule one at a time
		let deletedCount = 0;
		const errors: string[] = [];

		for (let i = 0; i < ruleIds.length; i++) {
			try {
				await deleteSingleRule(zoneId, rulesetId, ruleIds[i], token);
				deletedCount++;
			} catch (error) {
				const errorMsg = `Rule ${ruleIds[i]}: ${error instanceof Error ? error.message : 'Unknown error'}`;
				errors.push(errorMsg);
			}
		}

		// Return results
		if (deletedCount === ruleIds.length) {
			return jsonResponse({
				success: true,
				deletedCount,
				totalCount: ruleIds.length,
			});
		} else if (deletedCount > 0) {
			// Partial success
			return jsonResponse({
				success: false,
				deletedCount,
				totalCount: ruleIds.length,
				errors,
			}, 207); // Multi-Status
		} else {
			// Complete failure
			return jsonResponse({
				success: false,
				deletedCount: 0,
				totalCount: ruleIds.length,
				errors,
			}, 500);
		}

	} catch (error) {
		console.error('Error in handleDeleteRules:', error);
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
 * Delete a single WAF rule from a ruleset
 */
async function deleteSingleRule(
	zoneId: string,
	rulesetId: string,
	ruleId: string,
	apiToken: string
): Promise<void> {
	const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets/${rulesetId}/rules/${ruleId}`;

	const response = await fetch(url, {
		method: 'DELETE',
		headers: {
			'Authorization': `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to delete rule: ${response.status} ${errorText}`);
	}

	const data = await response.json() as any;

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
 * Get ruleset details including all rules
 */
async function getRulesetDetails(
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
		const errorText = await response.text();
		throw new Error(`Failed to get ruleset details: ${response.status} ${errorText}`);
	}

	const data = await response.json() as any;

	if (!data.success) {
		throw new Error(`API returned success=false: ${JSON.stringify(data.errors)}`);
	}

	return data.result;
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
