(function () {
	let layer, modal;

	function createUpdateModal() {
		const rootLayer = document.createElement('div');
		rootLayer.className = 'ui-layer ui-layer--modal';
		rootLayer.style.display = 'none';
		rootLayer.style.pointerEvents = 'auto';
		rootLayer.setAttribute('role', 'dialog');
		rootLayer.setAttribute('aria-modal', 'true');
		rootLayer.setAttribute('aria-label', 'Patch notes');

		const panel = document.createElement('div');
		panel.className = 'modal update-modal';

		const header = document.createElement('div');
		header.className = 'modal__header';
		header.textContent = 'Patch Notes';

		const body = document.createElement('div');
		body.className = 'modal__body nexus-scrollbar';
		body.style.maxHeight = 'calc(90vh - 130px)';
		body.style.overflow = 'auto';

		const footer = document.createElement('div');
		footer.className = 'modal__footer';

		const close = document.createElement('button');
		close.className = 'btn';
		close.type = 'button';
		close.textContent = 'Close';
		close.addEventListener('click', () => {
			if (Game) {
				Game.updateModalVisible = false;
			}
			// Update last run version so patch notes only show when version changes
			if (typeof SaveSystem !== 'undefined' && SaveSystem.setLastRunVersion && typeof Game !== 'undefined' && Game.VERSION) {
				SaveSystem.setLastRunVersion(Game.VERSION);
			}
			refresh();
		});
		footer.appendChild(close);

		panel.appendChild(header);
		panel.appendChild(body);
		panel.appendChild(footer);

		rootLayer.appendChild(panel);

		const root = window.UIRoot && window.UIRoot.ensure ? window.UIRoot.ensure() : document.body;
		root.appendChild(rootLayer);
		layer = rootLayer;
		modal = panel;
	}

	// Convert markdown string to HTML
	function markdownToHtml(markdown) {
		if (!markdown || typeof markdown !== 'string') return '';
		
		let html = '';
		const lines = markdown.split('\n');
		let inCodeBlock = false;
		let codeBlockContent = '';
		let inList = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();
			
			// Handle code blocks
			if (trimmed.startsWith('```')) {
				if (inCodeBlock) {
					// Close code block
					const pre = document.createElement('pre');
					const code = document.createElement('code');
					code.textContent = codeBlockContent.trim();
					pre.appendChild(code);
					html += pre.outerHTML;
					codeBlockContent = '';
					inCodeBlock = false;
				} else {
					// Open code block
					inCodeBlock = true;
					if (inList) {
						html += '</ul>';
						inList = false;
					}
				}
				continue;
			}
			
			if (inCodeBlock) {
				codeBlockContent += line + '\n';
				continue;
			}
			
			// Handle headers
			if (trimmed.startsWith('### ')) {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				const h3 = document.createElement('h3');
				h3.textContent = trimmed.substring(4);
				h3.style.margin = '16px 0 8px';
				h3.style.fontSize = '1.1em';
				html += h3.outerHTML;
				continue;
			}
			
			if (trimmed.startsWith('## ')) {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				const h2 = document.createElement('h2');
				h2.textContent = trimmed.substring(3);
				h2.style.margin = '20px 0 10px';
				h2.style.fontSize = '1.3em';
				h2.style.borderBottom = '1px solid rgba(150, 150, 255, 0.3)';
				h2.style.paddingBottom = '4px';
				html += h2.outerHTML;
				continue;
			}
			
			// Handle horizontal rules
			if (trimmed === '---' || trimmed === '***') {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				const hr = document.createElement('hr');
				hr.style.margin = '16px 0';
				hr.style.border = 'none';
				hr.style.borderTop = '1px solid rgba(150, 150, 255, 0.3)';
				html += hr.outerHTML;
				continue;
			}
			
			// Handle list items
			if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
				if (!inList) {
					html += '<ul style="padding-left: 20px; margin: 8px 0;">';
					inList = true;
				}
				const li = document.createElement('li');
				li.style.marginBottom = '6px';
				li.style.fontWeight = '500';
				li.innerHTML = parseInlineMarkdown(trimmed.substring(2));
				html += li.outerHTML;
				continue;
			}
			
			// Handle empty lines
			if (trimmed === '') {
				if (inList) {
					html += '</ul>';
					inList = false;
				}
				html += '<br>';
				continue;
			}
			
			// Regular paragraph
			if (inList) {
				html += '</ul>';
				inList = false;
			}
			const p = document.createElement('p');
			p.style.margin = '8px 0';
			p.style.fontWeight = '500';
			p.innerHTML = parseInlineMarkdown(trimmed);
			html += p.outerHTML;
		}
		
		if (inList) {
			html += '</ul>';
		}
		
		return html;
	}
	
	// Parse inline markdown (bold, italic, quotes, etc.)
	function parseInlineMarkdown(text) {
		if (!text) return '';
		
		// Escape HTML first
		text = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		
		// Handle quotes (*"text"*) - must be done before bold/italic
		text = text.replace(/\*"([^"]+)"\*/g, '<em style="color: #88ddff; font-style: italic;">"$1"</em>');
		
		// Handle bold (**text**) - must be done before single asterisk italic
		text = text.replace(/\*\*([^*]+)\*\*/g, '<strong style="color: #ffdd88;">$1</strong>');
		
		// Handle italic (*text*) - match single asterisks that aren't part of ** or *"
		// Since we've already processed ** and *", remaining *text* should be italic
		text = text.replace(/\*([^*"]+)\*/g, '<em>$1</em>');
		
		return text;
	}
	
	// Compare version strings (e.g., '0.5.3.1' > '0.5.2')
	function compareVersions(a, b) {
		const aParts = a.split('.').map(Number);
		const bParts = b.split('.').map(Number);
		const maxLen = Math.max(aParts.length, bParts.length);
		
		for (let i = 0; i < maxLen; i++) {
			const aVal = aParts[i] || 0;
			const bVal = bParts[i] || 0;
			if (aVal > bVal) return -1; // Newer first
			if (aVal < bVal) return 1;
		}
		return 0;
	}
	
	function renderNotes() {
		if (!modal) return;
		const body = modal.querySelector('.modal__body');
		if (!body) return;
		body.innerHTML = '';
		const messages = (typeof Game !== 'undefined' && Game.UPDATE_MESSAGES) ? Game.UPDATE_MESSAGES : {};
		const types = (typeof Game !== 'undefined' && Game.UPDATE_TYPES) ? Game.UPDATE_TYPES : {};
		const entries = Object.entries(messages);
		
		if (entries.length === 0) {
			const p = document.createElement('p');
			p.textContent = 'No patch notes available.';
			body.appendChild(p);
			return;
		}
		
		// Sort versions in reverse order (newest first)
		entries.sort((a, b) => compareVersions(a[0], b[0]));
		
		for (const [version, markdown] of entries) {
			// Create version header
			const versionContainer = document.createElement('div');
			versionContainer.style.marginBottom = '24px';
			versionContainer.style.paddingBottom = '16px';
			versionContainer.style.borderBottom = '1px solid rgba(150, 150, 255, 0.2)';
			
			const versionHeader = document.createElement('div');
			versionHeader.style.display = 'flex';
			versionHeader.style.alignItems = 'center';
			versionHeader.style.gap = '12px';
			versionHeader.style.marginBottom = '12px';
			
			const versionTitle = document.createElement('h3');
			versionTitle.textContent = `Version ${version}`;
			versionTitle.style.margin = '0';
			versionTitle.style.fontSize = '1.2em';
			versionTitle.style.color = '#ffdd88';
			
			versionHeader.appendChild(versionTitle);
			
			// Add type badges
			if (types[version] && Array.isArray(types[version])) {
				types[version].forEach(type => {
					const badge = document.createElement('span');
					badge.textContent = type;
					badge.style.padding = '2px 8px';
					badge.style.borderRadius = '4px';
					badge.style.fontSize = '0.75em';
					badge.style.textTransform = 'uppercase';
					badge.style.background = 'rgba(100, 100, 255, 0.3)';
					badge.style.border = '1px solid rgba(150, 150, 255, 0.5)';
					versionHeader.appendChild(badge);
				});
			}
			
			versionContainer.appendChild(versionHeader);
			
			// Render markdown content
			const content = document.createElement('div');
			content.className = 'patch-notes-content';
			content.style.lineHeight = '1.6';
			content.style.color = '#cccccc';
			content.style.fontWeight = '500';
			content.innerHTML = markdownToHtml(markdown);
			
			versionContainer.appendChild(content);
			body.appendChild(versionContainer);
		}
	}

	function isVisible() {
		return window.USE_DOM_UI && typeof Game !== 'undefined' && !!Game.updateModalVisible;
	}

	let updateModalEntry = null;
	function refresh() {
		if (!layer) return;
		const show = isVisible();
		if (show) {
			if (!updateModalEntry) {
				updateModalEntry = GameUI.openModal(layer, {
					closeOnEscape: true,
					onClose: () => { updateModalEntry = null; }
				});
			}
			renderNotes();
		} else if (updateModalEntry) {
			GameUI.closeModal(updateModalEntry);
			updateModalEntry = null;
		}
	}

	function tick() {
		refresh();
		requestAnimationFrame(tick);
	}

	function init() {
		createUpdateModal();
		tick();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
})();












