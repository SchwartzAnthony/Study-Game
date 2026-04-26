const STOP_WORDS = new Set([
    // English
    'the','a','an','and','or','but','if','then','than','that','this','these','those','is','are','was','were','be','been','being',
    'to','of','in','on','for','from','by','with','without','as','at','into','over','under','between','through','during','before','after',
    'it','its','they','them','their','he','she','his','her','you','your','we','our','i','me','my','mine','ours','yours','theirs',
    'can','could','should','would','may','might','must','will','shall','do','does','did','done','have','has','had','having',
    'not','no','yes','also','very','more','most','less','least','such','many','much','some','any','each','every','all','both',
    'up','down','out','off','again','further','once','here','there','when','where','why','how','what','which','who','whom',
    'about','above','below','because','while','until','against','among','within','across','per','via','etc',
    // German articles, pronouns, prepositions, conjunctions, common verbs
    'der','die','das','dem','den','des','ein','eine','einer','eines','einem','einen',
    'ich','du','er','sie','wir','ihr','mich','mir','dich','dir','ihn','ihm','sich','man',
    'und','oder','aber','denn','weil','dass','wenn','als','wie','damit','doch','auch','noch',
    'ist','sind','war','waren','wird','werden','hat','haben','hatte','hatten','sein','kann',
    'mit','von','aus','bei','nach','seit','vor','bis','auf','aus','fur','fuer','ueber','unter',
    'nicht','sehr','mehr','weniger','dann','also','hier','dort','jetzt','wieder','dabei','jedoch',
    'daher','schon','kein','keine','nur','nun','mal','bitte','zwar','immer','alle','alles',
    'diese','dieser','diesem','diesen','dieses','jede','jeden','jedem','jedes','jeder',
    'zum','zur','ins','ans','ums','vom','beim','einem','einer','eines',
    'durch','ohne','gegen','statt','wegen','trotz','wahrend','weil','obwohl',
    // German question words
    'warum','wieso','weshalb','welche','welcher','welches','welchem','welchen',
    'wann','wer','wen','wem','wessen','wodurch','womit','worin','woraus','woran',
    'deshalb','darum','trotzdem','somit','folglich','hierbei','hierdurch','hierfür',
    // German verbs that get misidentified as subjects
    'gibt','liegt','stellt','führt','macht','nimmt','setzt','folgt','nennt','zeigt',
    'heißt','heisst','lautet','befindet','ergibt','besteht','gilt','besagt','zeigen',
    'werden','können','müssen','sollen','dürfen','wollen','mögen','möchten',
    'muss','soll','darf','will','mag','kann','war','wäre','sei','wird','wurde',
    'habe','hast','habt','hatte','hatte','hätte','bist','sind','waren','wären',
    // German adjectives that are too generic
    'eigene','eigener','eigenes','eigenem','eigenen','gleiche','gleicher','solche',
    'große','kleinen','große','wichtig','wichtige','neue','neuer','alten','alte',
    // Page/section noise for German textbooks
    'mech','seite','seiten','abbildung','kapitel','abschnitt','lektion','ubung','aufgabe'
]);

const GAME_POOL = [
    'Flash Match',
    'Spellweaver',
    'Cloze Trial',
    'True/False Blitz',
    'Glimpse & Recall',
    'Ritual Alignment'
];

function cleanLine(line) {
    return String(line || '')
        .replace(/\s+/g, ' ')
        .replace(/[\u0000-\u001F]/g, '')
        .trim();
}

function isNoiseLine(line) {
    if (!line) return true;
    if (/^\d+$/.test(line)) return true;
    if (/^page\s*\d+(\s*of\s*\d+)?$/i.test(line)) return true;
    if (/^table of contents$/i.test(line)) return true;
    if (/^(inhalts|inhaltsverzeichnis|vorwort|impressum|literatur)/i.test(line)) return true;
    if (/^contents$/i.test(line)) return true;
    if (/^[ivxlcdm]+$/i.test(line)) return true;
    if (/^copyright|all rights reserved|isbn/i.test(line)) return true;
    if (/^©/.test(line)) return true;
    if (/^[-_~*=]{4,}$/.test(line)) return true;
    if (/\.{5,}/.test(line)) return true;
    if (/^\d{3,}[A-Z]\d+$/.test(line)) return true;
    // Page-header noise: "4 MECH 1", "12 MECH 1", "8 MECH 1" etc. (page number + course code)
    if (/^\d{1,3}\s+[A-Z]{2,6}\s+\d{1,2}$/.test(line)) return true;
    // Very short all-digit-and-letter formula/noise: "5 M", "1 M", "100 M 100 M ⋅ S 100 S"
    if (/^[\d\s\+\-\*\/=⋅\.MmKkGgSs,]{1,40}$/.test(line) && !/[a-zA-ZÄÖÜäöüß]{4,}/.test(line)) return true;
    return false;
}

function tokenizeWords(text) {
    return String(text || '')
        .toLowerCase()
        .match(/[a-z0-9][a-z0-9-]{2,}/g) || [];
}

function sentenceSplit(text) {
    return String(text || '')
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
        .map(s => s.trim())
        .filter(Boolean);
}

function titleCaseFromLine(line) {
    const normalized = cleanLine(line).replace(/[\s:;,.!?-]+$/g, '');
    if (!normalized) return 'Untitled Section';
    const words = normalized.split(' ').map(w => {
        if (/^[A-Z0-9]{2,}$/.test(w)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    });
    return words.join(' ');
}

function headingScore(line, fontHeight, medianHeight) {
    if (!line) return 0;
    let score = 0;
    const len = line.length;
    const chapterPattern = /^(chapter|unit|module|lesson|part)\s+\d+\b/i;
    const numericHeading = /^\d+(\.\d+){0,2}\s+[A-Za-z]/.test(line);
    const romanHeading = /^[IVXLC]+\.?\s+[A-Za-z]/.test(line);

    if (chapterPattern.test(line)) score += 4;
    if (numericHeading) score += 3;
    if (romanHeading) score += 2;
    if (len <= 90) score += 1;
    if (!/[.!?]$/.test(line)) score += 1;
    if (!/[,:;]/.test(line)) score += 1;

    const words = line.split(/\s+/).filter(Boolean);
    const titleLike = words.length > 1 && words.length <= 12 && words.filter(w => /^[A-Z][a-z0-9-]/.test(w)).length >= Math.ceil(words.length * 0.55);
    if (titleLike) score += 1;

    if (medianHeight > 0 && fontHeight > medianHeight * 1.12) score += 2;
    return score;
}

function hasOcrEngine() {
    return typeof window !== 'undefined' && !!window.Tesseract && typeof window.Tesseract.recognize === 'function';
}

function shouldRunOcr(lines) {
    const lineCount = lines.length;
    const totalChars = lines.reduce((sum, l) => sum + (l.text ? l.text.length : 0), 0);
    return lineCount < 4 || totalChars < 160;
}

function ocrTextToLines(text) {
    return String(text || '')
        .split(/\r?\n/)
        .map(cleanLine)
        .filter(line => line.length > 1)
        .map(line => ({ text: line, height: 0 }));
}

async function renderPageToCanvas(page, scale = 1.7) {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
}

async function runPageOCR(page, pageNum, progressCb) {
    try {
        const canvas = await renderPageToCanvas(page, 1.7);
        const result = await window.Tesseract.recognize(canvas, 'eng', {
            logger: (msg) => {
                if (!msg || msg.status !== 'recognizing text') return;
                const pct = typeof msg.progress === 'number' ? Math.floor(msg.progress * 100) : 0;
                progressCb(`OCR page ${pageNum}: ${pct}%`, undefined);
            }
        });
        return ocrTextToLines(result?.data?.text || '');
    } catch (e) {
        return [];
    }
}

async function extractPdfPages(file, progressCb) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const pages = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        progressCb(`Reading page ${i} / ${pdf.numPages}...`, Math.floor((i / pdf.numPages) * 55));
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const grouped = new Map();
        textContent.items.forEach(item => {
            const y = Math.round(item.transform[5]);
            const x = item.transform[4];
            if (!grouped.has(y)) grouped.set(y, []);
            grouped.get(y).push({ text: item.str, x, h: Math.abs(item.transform[0]) || 0 });
        });

        const sortedY = Array.from(grouped.keys()).sort((a, b) => b - a);
        let lines = sortedY.map(y => {
            const segs = grouped.get(y).sort((a, b) => a.x - b.x);
            const text = cleanLine(segs.map(s => s.text).join(' '));
            const avgHeight = segs.reduce((sum, s) => sum + s.h, 0) / Math.max(segs.length, 1);
            return { text, height: avgHeight };
        }).filter(l => l.text.length > 0);

        // OCR fallback for scanned/image PDFs when the native text layer is weak.
        if (hasOcrEngine() && shouldRunOcr(lines)) {
            progressCb(`Text layer weak on page ${i}; invoking OCR fallback...`, Math.floor((i / pdf.numPages) * 55));
            const ocrLines = await runPageOCR(page, i, progressCb);
            if (ocrLines.length > 0) {
                if (lines.length <= 2) {
                    lines = ocrLines;
                } else {
                    const existing = new Set(lines.map(l => l.text.toLowerCase()));
                    ocrLines.forEach(l => {
                        const key = l.text.toLowerCase();
                        if (!existing.has(key)) lines.push(l);
                    });
                }
            }
        }

        const images = [];
        try {
            const ops = await page.getOperatorList();
            for (let j = 0; j < ops.fnArray.length; j++) {
                const fn = ops.fnArray[j];
                if (fn !== pdfjsLib.OPS.paintImageXObject && fn !== pdfjsLib.OPS.paintJpegXObject) continue;
                const objId = ops.argsArray[j][0];
                const img = page.objs.get(objId);
                if (!img || !img.data || !img.width || !img.height) continue;

                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                const totalPixels = img.width * img.height;
                let imageData = null;

                if (img.data.length === totalPixels * 4) {
                    imageData = new ImageData(new Uint8ClampedArray(img.data), img.width, img.height);
                } else if (img.data.length === totalPixels * 3) {
                    const rgba = new Uint8ClampedArray(totalPixels * 4);
                    for (let k = 0, l = 0; k < img.data.length; k += 3, l += 4) {
                        rgba[l] = img.data[k];
                        rgba[l + 1] = img.data[k + 1];
                        rgba[l + 2] = img.data[k + 2];
                        rgba[l + 3] = 255;
                    }
                    imageData = new ImageData(rgba, img.width, img.height);
                }

                if (imageData) {
                    ctx.putImageData(imageData, 0, 0);
                    images.push(canvas.toDataURL('image/jpeg', 0.8));
                }
            }
        } catch (e) {
            // Image extraction is best-effort and intentionally non-fatal.
        }

        pages.push({ number: i, lines, images });
    }

    return pages;
}

function buildSectionsFromPages(pages, progressCb) {
    const allHeights = pages.flatMap(p => p.lines.map(l => l.height)).filter(h => h > 0);
    const sorted = [...allHeights].sort((a, b) => a - b);
    const medianHeight = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

    const sections = [];
    let current = null;

    function beginSection(title) {
        const section = {
            title: title || `Section ${sections.length + 1}`,
            paragraphs: [],
            images: [],
            sourcePages: []
        };
        sections.push(section);
        current = section;
    }

    beginSection('Opening Principles');

    for (let p = 0; p < pages.length; p++) {
        const page = pages[p];
        progressCb(`Structuring chapter flow (${p + 1} / ${pages.length})...`, 55 + Math.floor(((p + 1) / pages.length) * 20));

        if (page.images.length > 0) {
            current.images.push(...page.images.slice(0, 2));
        }

        let paragraphBuffer = [];
        for (let i = 0; i < page.lines.length; i++) {
            const line = cleanLine(page.lines[i].text);
            if (!line || isNoiseLine(line)) continue;

            const score = headingScore(line, page.lines[i].height, medianHeight);
            const isHeading = score >= 5 || (/^(chapter|unit|module|lesson|part|kapitel|abschnitt|lektion)\s+[\divx]/i.test(line));

            if (isHeading && line.length <= 120) {
                if (paragraphBuffer.length) {
                    current.paragraphs.push(paragraphBuffer.join(' '));
                    paragraphBuffer = [];
                }
                beginSection(titleCaseFromLine(line));
                continue;
            }

            paragraphBuffer.push(line);
            if (line.length < 55 || /[.!?]$/.test(line)) {
                current.paragraphs.push(paragraphBuffer.join(' '));
                paragraphBuffer = [];
            }
        }

        if (paragraphBuffer.length) {
            current.paragraphs.push(paragraphBuffer.join(' '));
        }

        current.sourcePages.push(page.number);
    }

    sections.forEach((section, index) => {
        section.paragraphs = section.paragraphs
            .map(p => cleanLine(p))
            .filter(p => p.length >= 35)
            .slice(0, 40);

        if (!section.paragraphs.length) {
            section.paragraphs.push(`No clear text was detected for ${section.title}. Review the source PDF for scanned images and low OCR quality.`);
        }

        if (!section.title || /^section\s+\d+$/i.test(section.title)) {
            const lead = section.paragraphs[0] || '';
            const candidate = lead.split(/[.!?]/)[0].slice(0, 60).trim();
            if (candidate.length > 10) section.title = titleCaseFromLine(candidate);
            else section.title = `Section ${index + 1}`;
        }
    });

    // Prune sections whose only content is the "No clear text" placeholder — absorb their title into the previous section
    const pruned = [];
    sections.forEach(section => {
        const isPlaceholderOnly = section.paragraphs.length === 1 && /^No clear text was detected/i.test(section.paragraphs[0]);
        if (isPlaceholderOnly && pruned.length > 0) {
            pruned[pruned.length - 1].paragraphs.push(`(Sub-topic: ${section.title})`);
        } else {
            pruned.push(section);
        }
    });
    return pruned.filter(s => s.paragraphs.length > 0);
}

function topKeywords(text, maxWords = 18) {
    const freq = new Map();
    tokenizeWords(text).forEach(word => {
        if (STOP_WORDS.has(word) || word.length < 3) return;
        freq.set(word, (freq.get(word) || 0) + 1);
    });

    return Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxWords)
        .map(([word]) => word);
}

function sanitizeQaPart(text, maxLen = 220) {
    const cleaned = cleanLine(String(text || '').replace(/::/g, ':'));
    return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen - 3)}...` : cleaned;
}

function buildStudyPack(section, allText) {
    const sentences = sentenceSplit(section.paragraphs.join(' '));
    const keywords = topKeywords(section.paragraphs.join(' '), 16);

    const flashcards = [];
    const quizzes = [];
    const exams = [];

    const definitionRegex = /^([A-Z][A-Za-zÄÖÜäöüß0-9\-\s]{2,50})\s+(is|are|refers to|means|ist|sind|bezeichnet|beschreibt|bedeutet|nennt man|heißt|heisst)\s+(.{20,240})$/;
    for (const sentence of sentences) {
        if (flashcards.length >= 8) break;
        const plain = sentence.replace(/\s+/g, ' ').trim();
        const matched = plain.match(definitionRegex);
        if (matched) {
            const subject = matched[1].trim();
            const subjectWords = subject.toLowerCase().split(/\s+/).filter(Boolean);
            // Skip if: whole phrase is a stop word, first word is a stop word, subject has OCR artifacts, or too many words
            if (
              STOP_WORDS.has(subject.toLowerCase()) ||
              STOP_WORDS.has(subjectWords[0]) ||
              subjectWords.length > 3 ||
              /\s-\s/.test(subject) // OCR hyphenation artifact
            ) continue;
            flashcards.push({
                q: sanitizeQaPart(`What is ${matched[1].trim()}?`, 120),
                a: sanitizeQaPart(matched[3], 240)
            });
        }
    }

    for (let i = 0; i < keywords.length && flashcards.length < 12; i++) {
        const kw = keywords[i];
        const sentence = sentences.find(s => s.toLowerCase().includes(kw));
        if (!sentence) continue;
        flashcards.push({
            q: sanitizeQaPart(`In ${section.title}, explain ${kw}.`, 130),
            a: sanitizeQaPart(sentence, 240)
        });
    }

    const uniqueFlash = [];
    const seenQ = new Set();
    flashcards.forEach(fc => {
        if (seenQ.has(fc.q)) return;
        seenQ.add(fc.q);
        uniqueFlash.push(fc);
    });

    uniqueFlash.slice(0, 5).forEach(fc => quizzes.push(fc));
    uniqueFlash.slice(0, 2).forEach(fc => exams.push(fc));

    const gameCount = section.paragraphs.join(' ').length > 1800 ? 4 : 3;
    const games = GAME_POOL.slice(0, gameCount);

    const ritualCore = keywords.slice(0, 3).map(w => `Summon ${w}`).join(' > ');
    const ritual = {
        name: `${section.title} Recall Rite`,
        steps: ritualCore || `Read ${section.title} > Recall key concepts > Write one teaching summary`
    };

    return {
        flashcards: uniqueFlash.slice(0, 12),
        quizzes: quizzes.slice(0, 5),
        exams: exams.slice(0, 3),
        games,
        ritual,
        keywords
    };
}

// ---------------------------------------------------------------------------
// GPT-POWERED GERMAN CONTENT GENERATION
// ---------------------------------------------------------------------------

async function generateContentWithGPT(sectionTitle, sectionText, apiKey) {
    const text = sectionText.slice(0, 4000);
    const prompt =
`Du bist ein KI-Lernassistent für das deutsche Abitur. Analysiere den folgenden Studientext und erstelle hochwertige Lernmaterialien auf Deutsch.

Abschnitt: "${sectionTitle}"

Text:
${text}

Erstelle NUR Zeilen in folgendem EXAKTEN Format — keine Einleitungen, keine anderen Zeilen:

!FLASH! Frage :: Antwort
(7–10 Karteikarten: Definitionen, Formeln, Gesetze, Zusammenhänge – Abitur-relevant)

!QUIZZ! Frage :: Antwort
(4–6 Quizfragen zur Wissensüberprüfung)

!EXAM! Frage :: Ausführliche Antwort
(2–3 Abitur-Prüfungsfragen mit vollständiger Begründung)

Regeln:
- Ausschließlich Deutsch
- Kein " :: " innerhalb der Frage oder Antwort — nur als Trennzeichen
- Formeln schreiben wie: F = m × a, v = s/t, a = Δv/Δt
- Nur !FLASH!/!QUIZZ!/!EXAM! Zeilen ausgeben`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2000,
            temperature: 0.25
        })
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`OpenAI ${response.status}: ${errText.slice(0, 120)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
}

function parseGPTContentLines(gptText) {
    const flashcards = [], quizzes = [], exams = [];
    for (const rawLine of String(gptText || '').split('\n')) {
        const line = rawLine.trim();
        if (!line || !/^!(FLASH|QUIZZ?|EXAM)!/i.test(line)) continue;
        const afterTag = line.replace(/^!(?:FLASH|QUIZZ?|EXAM)!\s*/i, '');
        const sepIdx = afterTag.indexOf(' :: ');
        if (sepIdx === -1) continue;
        const q = sanitizeQaPart(afterTag.slice(0, sepIdx), 220);
        const a = sanitizeQaPart(afterTag.slice(sepIdx + 4), 300);
        if (!q || !a) continue;
        if (/^!FLASH!/i.test(line)) flashcards.push({ q, a });
        else if (/^!QUIZZ?!/i.test(line)) quizzes.push({ q, a });
        else if (/^!EXAM!/i.test(line)) exams.push({ q, a });
    }
    return { flashcards, quizzes, exams };
}

async function buildStudyPacksWithGPT(sections, apiKey, progressCb) {
    const results = new Array(sections.length);
    const BATCH = 3; // parallel calls per round

    for (let i = 0; i < sections.length; i += BATCH) {
        const slice = sections.slice(i, Math.min(i + BATCH, sections.length));
        const batchResults = await Promise.all(slice.map(async (section, batchIdx) => {
            const idx = i + batchIdx;
            const rawText = section.paragraphs.join(' ');
            progressCb(
                `KI analysiert Abschnitt ${idx + 1}/${sections.length}: „${section.title.slice(0, 45)}"…`,
                75 + Math.floor((idx / sections.length) * 20)
            );

            try {
                const gptText = await generateContentWithGPT(section.title, rawText, apiKey);
                const parsed = parseGPTContentLines(gptText);

                // Fall back to local heuristics if GPT returned nothing useful
                if (parsed.flashcards.length === 0 && parsed.quizzes.length === 0) {
                    return buildStudyPack(section, rawText);
                }

                const gameCount = rawText.length > 1800 ? 4 : 3;
                const keywords = topKeywords(rawText, 6);
                const ritualCore = keywords.slice(0, 3).map(w => `Erkenne ${w}`).join(' > ');

                return {
                    flashcards: parsed.flashcards.slice(0, 12),
                    quizzes: parsed.quizzes.slice(0, 6),
                    exams: parsed.exams.slice(0, 3),
                    games: GAME_POOL.slice(0, gameCount),
                    ritual: {
                        name: `${section.title} – Wiederholungsritual`,
                        steps: ritualCore || `Lese ${section.title} > Kernbegriffe nennen > Zusammenfassung schreiben`
                    },
                    keywords
                };
            } catch (err) {
                progressCb(`GPT-Fehler bei „${section.title.slice(0, 30)}" → lokale Methode`, undefined);
                return buildStudyPack(section, rawText);
            }
        }));

        batchResults.forEach((result, batchIdx) => { results[i + batchIdx] = result; });

        // Small pause between batches to stay within rate limits
        if (i + BATCH < sections.length) await new Promise(r => setTimeout(r, 350));
    }
    return results;
}

function composeSyntax(worldName, sections, packs) {
    const out = [];
    // Do NOT emit a top-level !CHAPTER! worldName — that creates an empty section node
    // with no flashcards, making the Flashcards button permanently disabled for that node.

    sections.forEach((section, idx) => {
        out.push('');
        out.push(`!CHAPTER! ${sanitizeQaPart(section.title, 90)}`);

        const paraChunks = [];
        for (let i = 0; i < section.paragraphs.length; i += 3) {
            paraChunks.push(section.paragraphs.slice(i, i + 3).join('\n'));
        }
        out.push(paraChunks.join('\n\n!SECTION!\n\n'));

        section.images.slice(0, 2).forEach(img => {
            out.push(`!IMAGE! ${img}`);
        });

        const pack = packs[idx];
        pack.flashcards.forEach(fc => out.push(`!FLASH! ${fc.q} :: ${fc.a}`));
        pack.quizzes.forEach(qz => out.push(`!QUIZZ! ${qz.q} :: ${qz.a}`));
        pack.exams.forEach(ex => out.push(`!EXAM! ${ex.q} :: ${ex.a}`));
        pack.games.forEach(game => out.push(`!GAME! ${game}`));
        out.push(`!RITUAL! ${sanitizeQaPart(pack.ritual.name, 90)} :: ${sanitizeQaPart(pack.ritual.steps, 220)}`);
    });

    return out.join('\n\n');
}

function buildOwlTips(worldName, sections, packs) {
    const totalFlash = packs.reduce((sum, p) => sum + p.flashcards.length, 0);
    const totalQuiz = packs.reduce((sum, p) => sum + p.quizzes.length, 0);
    const densest = packs
        .map((p, i) => ({ i, score: p.keywords.length + p.flashcards.length }))
        .sort((a, b) => b.score - a.score)[0];

    const denseName = sections[densest?.i || 0]?.title || 'Opening Principles';

    return [
        `The grimoire \"${worldName}\" is forged. Begin with \"${denseName}\" for highest concept density.`,
        `Generated ${totalFlash} flashcards and ${totalQuiz} quiz prompts. Refine weak cards in the editor for perfect recall.`,
        `Use Cloze Trial after each chapter, then run True/False Blitz to pressure-test memory speed.`,
        `If a chapter feels noisy, trim text and regenerate only that chapter through the workshop converter.`,
        `Study rite: Read section -> Checkpoint -> Chronicle entry -> Mini-game -> Vault review before sleep.`
    ];
}

export async function forgeWorldFromPdf(file, progressCb = () => {}, apiKey = '') {
    const worldName = file.name.replace(/\.pdf$/i, '').trim() || 'Auto Forged World';

    progressCb('Öffne PDF und extrahiere Text (OCR-Fallback aktiv)…', 5);
    const pages = await extractPdfPages(file, progressCb);

    progressCb('Erkenne Kapitel und Abschnittsgrenzen…', 60);
    const sections = buildSectionsFromPages(pages, progressCb);

    let packs;
    const useGPT = apiKey && apiKey.startsWith('sk-');
    if (useGPT) {
        progressCb(`Generiere deutsche Abitur-Lernkarten mit KI (${sections.length} Abschnitte)…`, 75);
        packs = await buildStudyPacksWithGPT(sections, apiKey, progressCb);
    } else {
        progressCb('Generiere Lernkarten (offline, kein API-Schlüssel)…', 82);
        packs = sections.map((section, idx) => {
            const textScope = sections.slice(Math.max(0, idx - 1), idx + 1).map(s => s.paragraphs.join(' ')).join(' ');
            return buildStudyPack(section, textScope);
        });
    }

    const syntax = composeSyntax(worldName, sections, packs);
    const owlTips = buildOwlTips(worldName, sections, packs);

    const counts = {
        pages: pages.length,
        sections: sections.length,
        flashcards: packs.reduce((sum, p) => sum + p.flashcards.length, 0),
        quizzes: packs.reduce((sum, p) => sum + p.quizzes.length, 0),
        exams: packs.reduce((sum, p) => sum + p.exams.length, 0)
    };

    progressCb(useGPT ? 'KI-Forge abgeschlossen.' : 'Auto-Forge abgeschlossen.', 100);

    return {
        worldName,
        syntax,
        sections,
        packs,
        counts,
        owlTips
    };
}
