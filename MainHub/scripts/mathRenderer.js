function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizeMathMarkup(text) {
    return String(text || '').replace(/^\[MATH\]\s*(.+)$/gm, '$$$$ $1 $$$$');
}

export function hasMathSyntax(text) {
    const src = String(text || '');
    return /\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|^\[MATH\]/m.test(src);
}

function renderLatex(expr, displayMode) {
    if (!window.katex || !expr) return escapeHtml(expr);
    try {
        return window.katex.renderToString(expr, {
            throwOnError: false,
            strict: 'ignore',
            displayMode: !!displayMode
        });
    } catch (err) {
        return escapeHtml(expr);
    }
}

export function renderMathString(text, options = {}) {
    const src = normalizeMathMarkup(String(text || ''));
    const preferMath = !!options.preferMath;
    const preserveLineBreaks = options.preserveLineBreaks !== false;

    if (!src) return '';

    const tokenRe = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$]+\$)/g;
    const tokens = [];
    let lastIndex = 0;
    let match;

    while ((match = tokenRe.exec(src)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({ type: 'text', value: src.slice(lastIndex, match.index) });
        }
        tokens.push({ type: 'math', value: match[0] });
        lastIndex = match.index + match[0].length;
    }
    if (lastIndex < src.length) {
        tokens.push({ type: 'text', value: src.slice(lastIndex) });
    }

    if (tokens.length === 1 && tokens[0].type === 'text' && preferMath) {
        return renderLatex(tokens[0].value.trim(), true);
    }

    return tokens.map((token) => {
        if (token.type === 'text') {
            const safe = escapeHtml(token.value);
            return preserveLineBreaks ? safe.replace(/\n/g, '<br>') : safe;
        }

        const raw = token.value;
        let expr = raw;
        let displayMode = false;
        if (raw.startsWith('$$') && raw.endsWith('$$')) {
            expr = raw.slice(2, -2);
            displayMode = true;
        } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
            expr = raw.slice(2, -2);
            displayMode = true;
        } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
            expr = raw.slice(2, -2);
        } else if (raw.startsWith('$') && raw.endsWith('$')) {
            expr = raw.slice(1, -1);
        }
        return renderLatex(expr.trim(), displayMode);
    }).join('');
}

export function setRenderedText(el, text, options = {}) {
    if (!el) return;
    el.innerHTML = renderMathString(text, options);
}
