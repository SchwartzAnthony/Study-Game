
// =============================================================================
// PDF HIGHLIGHTER WIZARD v4
// Intro Gate + 10 Stages: Images -> Chapters -> Content -> Math -> Flashcards -> Quiz -> Exam -> Tasks -> Reminders -> Publish
// =============================================================================

export const TYPE_CONFIG = {
    flash: { label: 'Lernkarte', bg: 'rgba(255,224,0,0.38)',  border: 'rgba(255,200,0,0.9)',  text: '#ffe066' },
    quiz:  { label: 'Quiz',      bg: 'rgba(0,210,85,0.32)',   border: 'rgba(0,210,85,0.9)',   text: '#66ff99' },
    exam:  { label: 'Pruefung',  bg: 'rgba(220,50,50,0.32)',  border: 'rgba(220,50,50,0.9)',  text: '#ff9999' },
};

const STAGES = [
    { id: 'images',   label: 'Bilder',         icon: '1',  mode: 'canvas' },
    { id: 'chapters', label: 'Kapitel',         icon: '2',  mode: 'text'   },
    { id: 'content',  label: 'Kapitelinhalte',  icon: '3',  mode: 'text'   },
    { id: 'math',     label: 'Mathe',           icon: '4',  mode: 'text'   },
    { id: 'flash',    label: 'Lernkarten',      icon: '5',  mode: 'text'   },
    { id: 'quiz',     label: 'Quiz',            icon: '6',  mode: 'text'   },
    { id: 'exam',     label: 'Pruefung',        icon: '7',  mode: 'text'   },
    { id: 'tasks',    label: 'Tasks',           icon: '8',  mode: null     },
    { id: 'reminders',label: 'Merker',          icon: '9',  mode: 'text'   },
    { id: 'publish',  label: 'Veroeffentlichen',icon: '10', mode: null     },
];

const MATH_TARGET_OPTIONS = [
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quizzes', label: 'Quiz' },
    { id: 'exams', label: 'Exam' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'minigames', label: 'Mini-Games' },
    { id: 'content', label: 'Section Content' }
];

let hlDoc    = null;
let hlStage  = 0;
let hlIntroGate = true;
let hlDraft  = { pdfName:'', images:[], chapters:[], chapterTexts:{}, mathItems:[], flashcards:[], quizzes:[], exams:[], tasks:[], reminders:[] };
let hlRenderToken = 0;
let qaTarget = 'question';
let pendingQA = { section:'', q:{text:'',imageId:null}, a:{text:'',imageId:null}, voidEnabled:true };
let pendingQAMode = 'flashcards';
let mathTarget = 'question';
let pendingMath = { section:'', q:'', latex:'', a:'', category:'flashcards', voidEnabled:true };
let pendingReminder = { section:'', text:'', imageId:null, voidEnabled:true };
let activeChapter = '';
let _selectedHubIndex = 0;
let _appState=null, _saveStore=null, _renderMap=null, _genCoords=null, _showToast=null;

function _emptyPending(){ return { section:'', q:{text:'',imageId:null}, a:{text:'',imageId:null}, voidEnabled:true }; }
function _el(id){ return document.getElementById(id); }
function _uid(){ return Date.now()+Math.random(); }
function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function openPdfHighlighter(file, deps) {
    deps = deps || {};
    _appState  = deps.appState  || null;
    _saveStore = deps.saveToStorage || null;
    _renderMap = deps.renderMap || null;
    _genCoords = deps.generateMapCoordinates || null;
    _showToast = deps.showToast || null;
    hlDoc = null; hlStage = 0; hlIntroGate = true;
    hlDraft = { pdfName: file.name.replace(/\.[^.]+$/, '').trim(), images:[], chapters:[], chapterTexts:{}, mathItems:[], flashcards:[], quizzes:[], exams:[], tasks:[], reminders:[] };
    pendingQA = _emptyPending();
    pendingMath = { section:'', q:'', latex:'', a:'', category:'flashcards', voidEnabled:true };
    pendingReminder = { section:'', text:'', imageId:null, voidEnabled:true };
    mathTarget = 'question';
    activeChapter = '';
    _selectedHubIndex = (_appState && _appState.currentHubIndex) ? _appState.currentHubIndex : 0;
    try {
        var buf = await file.arrayBuffer();
        hlDoc = await pdfjsLib.getDocument({ data: buf }).promise;
    } catch(e) { alert('PDF konnte nicht geladen werden.'); return; }
    var modal = document.getElementById('pdf-highlighter-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    _renderStage();
}

export function initHighlighterUI() { /* Listeners are wired dynamically per stage */ }
export function importHighlightsToWorld() { return 0; }
export function getHighlightItems() { return []; }

// ---------------------------------------------------------------------------
// Stage orchestration
// ---------------------------------------------------------------------------

function _renderStage() {
    if (hlIntroGate) {
        _renderIntroGate();
        return;
    }
    var token = ++hlRenderToken;
    _renderStageHeader();
    _renderStagePDF(token).then(function(){
        if (token !== hlRenderToken) return;
        _renderStagePanel();
    });
}

function _renderIntroGate() {
    var hdr = _el('hl-stage-header');
    var left = _el('hl-pdf-content');
    var panel = _el('hl-stage-panel');
    if (!hdr || !left || !panel) return;

    hdr.innerHTML = [
        '<div style="display:flex;align-items:center;gap:9px;padding:10px 14px;background:#0e0e14;border-bottom:1px solid rgba(162,155,254,0.25);">',
        '<span style="font-size:0.95em;color:#a29bfe;font-family:Cinzel,serif;font-weight:bold;">PDF Wizard Introduction</span>',
        '<span style="font-size:0.72em;color:#4f4f68;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(hlDraft.pdfName)+'</span>',
        '<button id="btn-hl-intro-back" style="padding:6px 13px;background:#1c1c28;border:1px solid #333;color:#aaa;border-radius:5px;cursor:pointer;font-size:0.82em;">Zurueck</button>',
        '<button id="btn-hl-intro-start" style="padding:6px 16px;background:linear-gradient(135deg,#6c56cc,#a29bfe);border:none;color:#fff;border-radius:5px;cursor:pointer;font-size:0.85em;font-weight:bold;">Start Wizard</button>',
        '</div>'
    ].join('');

    left.innerHTML = [
        '<div style="max-width:860px;margin:18px auto 30px;padding:16px 18px;border:1px solid rgba(162,155,254,0.28);border-radius:10px;background:rgba(17,14,29,0.62);">',
        '<h3 style="margin:0 0 10px;color:#d8d4ff;font-family:Cinzel,serif;">How Highlight Features Work</h3>',
        '<p style="margin:0 0 10px;color:#b8b3d7;font-size:0.88em;line-height:1.6;">Highlight directly in the PDF. Each wizard step stores a different content type and builds your world automatically on publish.</p>',
        '<ul style="margin:0;padding-left:18px;color:#a8a3cc;font-size:0.84em;line-height:1.65;">',
        '<li><strong>Bilder:</strong> Drag a rectangle to capture diagrams.</li>',
        '<li><strong>Kapitel:</strong> Highlight headings to create world sections.</li>',
        '<li><strong>Kapitelinhalte:</strong> Highlight core text for each section.</li>',
        '<li><strong>Mathe:</strong> Highlight equations/questions, optionally assign target category (Flashcard/Quiz/Exam/Task/Mini-Game/Content). You can skip this step.</li>',
        '<li><strong>Lernkarten & Quiz:</strong> Build Q/A study pairs.</li>',
        '<li><strong>Pruefung:</strong> Add deeper exam prompts.</li>',
        '<li><strong>Tasks:</strong> Create action checklist items.</li>',
        '<li><strong>Merker:</strong> Highlight high-value reminders and attach key images.</li>',
        '<li><strong>Veroeffentlichen:</strong> Choose hub, create world, and save.</li>',
        '</ul>',
        '</div>'
    ].join('');

    panel.innerHTML = [
        '<div style="padding:14px;display:flex;flex-direction:column;gap:10px;">',
        '<p style="margin:0;color:#a29bfe;font-size:0.8em;text-transform:uppercase;letter-spacing:1px;">Before You Start</p>',
        '<p style="margin:0;color:#8b86b0;font-size:0.8em;line-height:1.55;">Use Start Wizard to begin extraction. Use Zurueck to return to the previous menu without changing anything.</p>',
        '<button id="btn-hl-intro-start-2" style="padding:9px 12px;background:linear-gradient(135deg,#6c56cc,#a29bfe);border:none;color:#fff;border-radius:6px;cursor:pointer;font-size:0.84em;font-weight:bold;">Start Wizard</button>',
        '<button id="btn-hl-intro-back-2" style="padding:8px 12px;background:#1c1c28;border:1px solid #333;color:#aaa;border-radius:6px;cursor:pointer;font-size:0.82em;">Zurueck</button>',
        '</div>'
    ].join('');

    function _start() { hlIntroGate = false; _renderStage(); }
    function _back() { document.getElementById('pdf-highlighter-modal').classList.add('hidden'); }
    var s1 = _el('btn-hl-intro-start'); if (s1) s1.addEventListener('click', _start);
    var s2 = _el('btn-hl-intro-start-2'); if (s2) s2.addEventListener('click', _start);
    var b1 = _el('btn-hl-intro-back'); if (b1) b1.addEventListener('click', _back);
    var b2 = _el('btn-hl-intro-back-2'); if (b2) b2.addEventListener('click', _back);
}

function _renderStageHeader() {
    var hdr = _el('hl-stage-header');
    if (!hdr) return;
    var stage = STAGES[hlStage];
    var dots = STAGES.map(function(s,i){
        var active=i===hlStage, done=i<hlStage;
        var col = active?'#a29bfe':done?'#66ff99':'#2a2a3a';
        var bdr = active?'#d6d1ff':done?'#44ff88':'#444';
        return '<span title="'+s.label+'" data-sdot="'+i+'" style="width:11px;height:11px;border-radius:50%;display:inline-block;margin:0 3px;background:'+col+';cursor:'+(i<=hlStage?'pointer':'default')+';border:1px solid '+bdr+';"></span>';
    }).join('');
    var isLast = hlStage === STAGES.length - 1;
    hdr.innerHTML = '<div style="display:flex;align-items:center;gap:9px;padding:8px 14px;background:#0e0e14;border-bottom:1px solid rgba(162,155,254,0.25);flex-wrap:wrap;">'
        +'<span id="hl-close-btn" style="font-size:1.55em;cursor:pointer;color:#777;line-height:1;flex-shrink:0;">&times;</span>'
        +'<div style="display:flex;align-items:center;gap:3px;">'+dots+'</div>'
        +'<span style="font-size:0.9em;color:#a29bfe;font-family:Cinzel,serif;font-weight:bold;flex-shrink:0;">Schritt '+(hlStage+1)+'/'+STAGES.length+' &middot; '+stage.label+'</span>'
        +'<span style="font-size:0.72em;color:#444;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+_esc(hlDraft.pdfName)+'</span>'
        +'<button id="btn-hl-back" style="padding:5px 13px;background:#1c1c28;border:1px solid #333;color:#aaa;border-radius:5px;cursor:pointer;font-size:0.82em;"'+(hlStage===0?' disabled':'')+'>Zurueck</button>'
        +'<button id="btn-hl-next" style="padding:5px 16px;background:linear-gradient(135deg,#6c56cc,#a29bfe);border:none;color:#fff;border-radius:5px;cursor:pointer;font-size:0.85em;font-weight:bold;">'+(isLast?'Fertig':'Weiter')+'</button>'
        +'</div>';
    _el('hl-close-btn').addEventListener('click', function(){
        if(confirm('Wizard schliessen? Nicht gespeicherte Arbeit geht verloren.')){
            document.getElementById('pdf-highlighter-modal').classList.add('hidden');
        }
    });
    _el('btn-hl-back').addEventListener('click', function(){ if(hlStage>0){ hlStage--; _renderStage(); } });
    _el('btn-hl-next').addEventListener('click', function(){
        if(!_validateStage()) return;
        if(hlStage < STAGES.length-1){ hlStage++; _renderStage(); }
    });
    hdr.querySelectorAll('[data-sdot]').forEach(function(dot){
        dot.addEventListener('click', function(){
            var i=parseInt(dot.dataset.sdot);
            if(i<=hlStage){ hlStage=i; _renderStage(); }
        });
    });
}

function _validateStage() {
    var id = STAGES[hlStage].id;
    if(id==='chapters' && hlDraft.chapters.length===0){ alert('Bitte mindestens eine Kapitelueberschrift markieren!'); return false; }
    return true;
}

async function _renderStagePDF(token) {
    var stage = STAGES[hlStage];
    var container = _el('hl-pdf-content');
    if(!container || !hlDoc) return;
    container.removeEventListener('mouseup', _onTextMouseUp);
    if(stage.mode==='canvas') await _renderCanvasPages(container, token);
    else if(stage.mode==='text') await _renderTextPages(container, stage.id, token);
    else container.innerHTML='';
}

// ---------------------------------------------------------------------------
// PDF Rendering
// ---------------------------------------------------------------------------

async function _renderTextPages(container, stageId, token) {
    if (token !== hlRenderToken) return;
    container.innerHTML = '<p style="color:#555;text-align:center;margin-top:60px;font-family:Cinzel,serif;">Lade Text...</p>';
    container.style.cursor = 'text';
    container.innerHTML='';
    var HINTS = {
        chapters:'Kapitelueberschriften im PDF auswaehlen (werden zu Sections auf der Weltkarte).',
        content:'Text markieren. Aktives Kapitel rechts waehlen.',
        math:'Mathe-Ausdruecke markieren. Danach rechts Kategorie waehlen und Hinzufuegen (oder Schritt ueberspringen).',
        flash:'LILA = Frage  |  BLAU = Antwort.  Modus rechts waehlen, markieren, dann Hinzufuegen.',
        quiz:'LILA = Frage  |  BLAU = Antwort.  Modus rechts waehlen, markieren, dann Hinzufuegen.',
        exam:'Text als Pruefungsstoff markieren — oder rechts aus Lernkarten/Quiz uebernehmen.',
        reminders:'Markiere Kerngedanken als Reminder. Rechts Kapitel und optional ein Bild zuweisen.'
    };
    if(HINTS[stageId]){
        var h=document.createElement('p');
        h.style.cssText='margin:0 0 10px;background:#1a1a2e;color:#a29bfe;font-size:0.8em;padding:9px 16px;border-radius:5px;text-align:center;line-height:1.5;';
        h.textContent=HINTS[stageId]; container.appendChild(h);
    }

    for (var i=1; i<=hlDoc.numPages; i++) {
        if (token !== hlRenderToken) return;
        var page = await hlDoc.getPage(i);
        if (token !== hlRenderToken) return;
        var baseVp = page.getViewport({ scale: 1 });
        var scale = Math.min(1.35, Math.max(0.85, (container.clientWidth - 40) / baseVp.width));
        var vp = page.getViewport({ scale: scale });

        var sep=document.createElement('div');
        sep.style.cssText='text-align:center;color:#444;font-size:0.78em;margin:20px 0 5px;padding:3px 0;border-top:1px solid #222;letter-spacing:2px;';
        sep.textContent='--- Seite '+i+' ---';
        container.appendChild(sep);

        var pageWrap = document.createElement('div');
        pageWrap.style.cssText='position:relative;display:block;margin:0 auto 12px;width:'+vp.width+'px;height:'+vp.height+'px;max-width:100%;border:1px solid #2a2a3a;border-radius:4px;background:#fff;overflow:hidden;';

        var canvas = document.createElement('canvas');
        canvas.width = vp.width;
        canvas.height = vp.height;
        canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%;';

        try {
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        } catch (e) {
            console.warn('Page '+i+' text-view render error', e);
            continue;
        }
        if (token !== hlRenderToken) return;

        pageWrap.appendChild(canvas);

        var textLayer = document.createElement('div');
        textLayer.className = 'hl-page-text';
        textLayer.dataset.page = i;
        textLayer.style.cssText='position:absolute;inset:0;line-height:1;user-select:text;-webkit-user-select:text;color:transparent;';

        var tc = await page.getTextContent({ includeMarkedContent: true });
        if (token !== hlRenderToken) return;
        for (var ti=0; ti<tc.items.length; ti++) {
            var item = tc.items[ti];
            if (!item || !item.str) continue;

            var m = pdfjsLib.Util.transform(vp.transform, item.transform);
            var angle = Math.atan2(m[1], m[0]);
            var fontHeight = Math.sqrt((m[2] * m[2]) + (m[3] * m[3]));

            var span = document.createElement('span');
            span.textContent = item.str;

            var left = m[4];
            var top = m[5] - fontHeight;

            span.style.cssText =
                'position:absolute;white-space:pre;transform-origin:0 0;color:transparent;'
                + 'left:' + left + 'px;top:' + top + 'px;'
                + 'font-size:' + Math.max(fontHeight, 8) + 'px;'
                + 'font-family:sans-serif;'
                + (angle ? ('transform:rotate(' + angle + 'rad);') : '');

            textLayer.appendChild(span);
        }

        pageWrap.appendChild(textLayer);
        container.appendChild(pageWrap);
    }

    container.addEventListener('mouseup', _onTextMouseUp);
}

async function _renderCanvasPages(container) {
    var token = arguments[1];
    if (token !== hlRenderToken) return;
    container.innerHTML='<p style="color:#555;text-align:center;margin-top:60px;font-family:Cinzel,serif;">Rendere Seiten...</p>';
    container.style.cursor='default';
    await new Promise(function(r){setTimeout(r,20);});
    if (token !== hlRenderToken) return;
    container.innerHTML='';
    var hint=document.createElement('p');
    hint.style.cssText='text-align:center;color:#666;font-size:0.8em;margin:6px 0 14px;';
    hint.textContent='Rechteck aufziehen um ein Bild zu erfassen.'; container.appendChild(hint);
    for(var i=1;i<=hlDoc.numPages;i++){
        if (token !== hlRenderToken) return;
        var page=await hlDoc.getPage(i);
        if (token !== hlRenderToken) return;
        var baseVp=page.getViewport({scale:1});
        var scale=Math.min(1.5,Math.max(0.8,(container.clientWidth-40)/baseVp.width));
        var vp=page.getViewport({scale:scale});
        var sep=document.createElement('div');
        sep.style.cssText='text-align:center;color:#444;font-size:0.78em;margin:20px 0 5px;padding:3px 0;border-top:1px solid #222;letter-spacing:2px;';
        sep.textContent='--- Seite '+i+' ---'; container.appendChild(sep);
        var wrapper=document.createElement('div');
        wrapper.style.cssText='position:relative;display:block;margin:0 auto 10px;width:'+vp.width+'px;height:'+vp.height+'px;max-width:100%;';
        var canvas=document.createElement('canvas');
        canvas.width=vp.width; canvas.height=vp.height;
        canvas.style.cssText='display:block;border:1px solid #2a2a3a;border-radius:4px;width:100%;height:auto;';
        try{ await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise; }
        catch(e){ console.warn('Page '+i+' render error',e); continue; }
        if (token !== hlRenderToken) return;
        var overlay=document.createElement('div');
        overlay.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;cursor:crosshair;';
        wrapper.appendChild(canvas); wrapper.appendChild(overlay); container.appendChild(wrapper);
        _addCanvasDragSelect(overlay, canvas);
    }
}

function _addCanvasDragSelect(overlay, canvas) {
    var startX=0,startY=0,dragging=false,selBox=null;
    function _commit(cx,cy){
        if(!dragging) return; dragging=false;
        document.removeEventListener('mousemove',_move); document.removeEventListener('mouseup',_up);
        var r=overlay.getBoundingClientRect();
        var ex=cx-r.left, ey=cy-r.top;
        var l=Math.min(startX,ex), t=Math.min(startY,ey);
        var w=Math.abs(ex-startX), h=Math.abs(ey-startY);
        if(selBox){selBox.remove();selBox=null;}
        if(w<12||h<12) return;
        var cr=canvas.getBoundingClientRect();
        var sx=canvas.width/cr.width, sy=canvas.height/cr.height;
        var px=Math.max(0,Math.round(l*sx)), py=Math.max(0,Math.round(t*sy));
        var pw=Math.min(Math.round(w*sx),canvas.width-px), ph=Math.min(Math.round(h*sy),canvas.height-py);
        if(pw<4||ph<4) return;
        var crop=document.createElement('canvas'); crop.width=pw; crop.height=ph;
        crop.getContext('2d').drawImage(canvas,px,py,pw,ph,0,0,pw,ph);
        _captureImage(crop.toDataURL('image/jpeg',0.82));
    }
    function _move(e){
        if(!dragging||!selBox) return;
        var r=overlay.getBoundingClientRect();
        var cx=e.clientX-r.left, cy=e.clientY-r.top;
        selBox.style.left=Math.min(startX,cx)+'px'; selBox.style.top=Math.min(startY,cy)+'px';
        selBox.style.width=Math.abs(cx-startX)+'px'; selBox.style.height=Math.abs(cy-startY)+'px';
    }
    function _up(e){ _commit(e.clientX,e.clientY); }
    overlay.addEventListener('mousedown',function(e){
        e.preventDefault(); e.stopPropagation();
        var r=overlay.getBoundingClientRect();
        startX=e.clientX-r.left; startY=e.clientY-r.top; dragging=true;
        if(selBox) selBox.remove();
        selBox=document.createElement('div');
        selBox.style.cssText='position:absolute;border:2px dashed #a29bfe;background:rgba(162,155,254,0.15);pointer-events:none;box-sizing:border-box;';
        overlay.appendChild(selBox);
        document.addEventListener('mousemove',_move); document.addEventListener('mouseup',_up);
    });
}

function _captureImage(dataURL){
    hlDraft.images.push({id:_uid(),dataURL:dataURL,label:'',voidEnabled:false});
    _renderStagePanel();
}

// ---------------------------------------------------------------------------
// Text selection dispatcher + mark wrapper
// ---------------------------------------------------------------------------

function _onTextMouseUp() {
    var sel=window.getSelection();
    if(!sel||sel.isCollapsed||sel.rangeCount===0) return;
    var text=sel.toString().trim();
    if(text.length<2){ sel.removeAllRanges(); return; }
    var range=sel.getRangeAt(0);
    if(!range.startContainer.parentElement||!range.startContainer.parentElement.closest('.hl-page-text')){ sel.removeAllRanges(); return; }
    var id=STAGES[hlStage].id;
    if(id==='chapters')      _doChapterCapture(text,range);
    else if(id==='content')  _doContentCapture(text,range);
    else if(id==='math')     _doMathCapture(text,range);
    else if(id==='flash')    _doQACapture(text,range);
    else if(id==='quiz')     _doQACapture(text,range);
    else if(id==='exam')     _doExamCapture(text,range);
    else if(id==='reminders') _doReminderCapture(text,range);
    sel.removeAllRanges();
}

function _wrapMark(range,border,bg) {
    var mark=document.createElement('mark');
    mark.style.cssText='background:'+bg+';outline:1px solid '+border+';border-radius:2px;padding:0 1px;';
    try{ range.surroundContents(mark); }
    catch(e){ try{ var f=range.extractContents(); mark.appendChild(f); range.insertNode(mark); }catch(e2){} }
}

function _doChapterCapture(text,range) {
    _wrapMark(range,'#d4a843','rgba(212,168,67,0.3)');
    hlDraft.chapters.push({id:_uid(),name:text.trim()});
    if(!activeChapter) activeChapter=text.trim();
    _renderStagePanel();
}

function _doContentCapture(text,range) {
    if(!activeChapter){ alert('Bitte zuerst ein aktives Kapitel rechts auswaehlen!'); return; }
    _wrapMark(range,'#a29bfe','rgba(162,155,254,0.2)');
    if(!hlDraft.chapterTexts[activeChapter]) hlDraft.chapterTexts[activeChapter]=[];
    hlDraft.chapterTexts[activeChapter].push(text.trim());
    _renderStagePanel();
}

function _doQACapture(text,range) {
    var isQ=qaTarget==='question';
    _wrapMark(range, isQ?'#b39dfe':'#67e8f9', isQ?'rgba(179,157,254,0.28)':'rgba(103,232,249,0.22)');
    if(isQ) pendingQA.q.text=text.trim();
    else    pendingQA.a.text=text.trim();
    _renderStagePanel();
}

function _doMathCapture(text,range) {
    var isQ = mathTarget === 'question';
    _wrapMark(range, isQ?'#ffd166':'#67e8f9', isQ?'rgba(255,209,102,0.28)':'rgba(103,232,249,0.20)');
    if (isQ) pendingMath.q = text.trim();
    else pendingMath.a = text.trim();
    _renderStagePanel();
}

function _doExamCapture(text,range) {
    if(!activeChapter){ alert('Bitte zuerst ein aktives Kapitel rechts auswaehlen!'); return; }
    _wrapMark(range,'#ff7675','rgba(255,118,117,0.2)');
    hlDraft.exams.push({id:_uid(),section:activeChapter,question:text.trim(),answer:'',elaboration:'',qImageData:null,aImageData:null,voidEnabled:true});
    _renderStagePanel();
}

function _doReminderCapture(text, range) {
    if(!activeChapter){ alert('Bitte zuerst ein aktives Kapitel rechts auswaehlen!'); return; }
    _wrapMark(range, '#4cd137', 'rgba(76,209,55,0.2)');
    pendingReminder.section = activeChapter;
    pendingReminder.text = text.trim();
    _renderStagePanel();
}

// ---------------------------------------------------------------------------
// Stage panel dispatcher + Images panel
// ---------------------------------------------------------------------------

function _renderStagePanel() {
    var panel=_el('hl-stage-panel');
    if(!panel) return;
    var id=STAGES[hlStage].id;
    if(id==='images')   _renderPanelImages(panel);
    else if(id==='chapters') _renderPanelChapters(panel);
    else if(id==='content')  _renderPanelContent(panel);
    else if(id==='math')     _renderPanelMath(panel);
    else if(id==='flash')    _renderPanelQA(panel,'flashcards');
    else if(id==='quiz')     _renderPanelQA(panel,'quizzes');
    else if(id==='exam')     _renderPanelExam(panel);
    else if(id==='tasks')    _renderPanelTasks(panel);
    else if(id==='reminders') _renderPanelReminders(panel);
    else if(id==='publish')  _renderPanelPublish(panel);
}

// ---------------------------------------------------------------------------
// Math panel (Stage 4, optional)
// ---------------------------------------------------------------------------
function _renderPanelMath(panel) {
    var chapters = hlDraft.chapters.map(function(c){ return c.name; });
    if (!pendingMath.section && chapters.length) pendingMath.section = chapters[0];
    var chOpts = chapters.map(function(c){ return '<option value="'+_esc(c)+'"'+(c===pendingMath.section?' selected':'')+'>'+_esc(c)+'</option>'; }).join('');
    var catOpts = MATH_TARGET_OPTIONS.map(function(o){ return '<option value="'+o.id+'"'+(o.id===pendingMath.category?' selected':'')+'>'+o.label+'</option>'; }).join('');
    var canAdd = (pendingMath.q||'').trim().length > 0;

    panel.innerHTML = [
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;display:flex;flex-direction:column;gap:7px;">',
          '<p style="margin:0;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Math Equation / Question</p>',
          '<select id="hl-math-ch" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>',
          '<div style="display:flex;gap:5px;">',
            '<button id="btn-math-q" style="flex:1;padding:6px;border-radius:4px;cursor:pointer;font-size:0.82em;font-weight:bold;'
              +'background:'+(mathTarget==='question'?'rgba(255,209,102,0.26)':'#181820')
              +';border:2px solid '+(mathTarget==='question'?'#ffd166':'#333')
              +';color:'+(mathTarget==='question'?'#ffd98e':'#555')+';">Formula / Prompt</button>',
            '<button id="btn-math-a" style="flex:1;padding:6px;border-radius:4px;cursor:pointer;font-size:0.82em;font-weight:bold;'
              +'background:'+(mathTarget==='answer'?'rgba(103,232,249,0.22)':'#181820')
              +';border:2px solid '+(mathTarget==='answer'?'#67e8f9':'#333')
              +';color:'+(mathTarget==='answer'?'#67e8f9':'#555')+';">Answer / Note</button>',
          '</div>',
          '<textarea id="hl-math-qtxt" rows="2" placeholder="Highlighted math or prompt from the PDF" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#f6db95;border-radius:3px;padding:5px 6px;font-size:0.9em;box-sizing:border-box;resize:vertical;">'+_esc(pendingMath.q)+'</textarea>',
          '<textarea id="hl-math-latex" rows="2" placeholder="Canonical math / LaTeX (recommended for complex equations, e.g. \\frac{a}{b} = c)" style="width:100%;background:#0a0a12;border:1px solid rgba(103,232,249,0.35);color:#c7f4ff;border-radius:3px;padding:5px 6px;font-size:0.9em;box-sizing:border-box;resize:vertical;">'+_esc(pendingMath.latex||'')+'</textarea>',
          '<textarea id="hl-math-atxt" rows="2" placeholder="Optional answer / explanation" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#a0e8f8;border-radius:3px;padding:5px 6px;font-size:0.9em;box-sizing:border-box;resize:vertical;">'+_esc(pendingMath.a)+'</textarea>',
          '<label style="font-size:0.72em;color:#7d7899;">Category</label>',
          '<select id="hl-math-cat" style="width:100%;padding:5px;background:#111;border:1px solid rgba(255,209,102,0.35);color:#e8dbaf;border-radius:4px;font-size:0.82em;">'+catOpts+'</select>',
                    '<label style="display:flex;align-items:center;gap:8px;font-size:0.78em;color:#a7f3c3;"><input id="hl-math-void" type="checkbox" '+(pendingMath.voidEnabled?'checked':'')+' style="accent-color:#4cd137;">Add this object to The Void</label>',
          '<div style="display:flex;gap:6px;">',
            '<button id="btn-math-add" '+(canAdd?'':'disabled')+' style="flex:1;padding:7px;background:'+(canAdd?'rgba(102,255,153,0.15)':'#141414')+';border:1px solid '+(canAdd?'#66ff99':'#2a2a2a')+';color:'+(canAdd?'#66ff99':'#444')+';border-radius:5px;cursor:'+(canAdd?'pointer':'not-allowed')+';font-weight:bold;font-size:0.84em;">+ Add Math Item</button>',
            '<button id="btn-math-skip" style="padding:7px 11px;background:#1c1c28;border:1px solid #333;color:#aaa;border-radius:5px;cursor:pointer;font-size:0.82em;">Skip</button>',
          '</div>',
        '</div>',
        '<div id="hl-math-list" style="flex:1;overflow-y:auto;padding:10px;">',
          '<p style="margin:0 0 6px;font-size:0.7em;color:#555;text-transform:uppercase;letter-spacing:1px;">'+hlDraft.mathItems.length+' Math item(s)</p>',
        '</div>'
    ].join('');

    var chSel = _el('hl-math-ch'); if (chSel) chSel.addEventListener('change', function(e){ pendingMath.section = e.target.value; });
    var qBtn = _el('btn-math-q'); if (qBtn) qBtn.addEventListener('click', function(){ mathTarget='question'; _renderStagePanel(); });
    var aBtn = _el('btn-math-a'); if (aBtn) aBtn.addEventListener('click', function(){ mathTarget='answer'; _renderStagePanel(); });
    var qTxt = _el('hl-math-qtxt'); if (qTxt) qTxt.addEventListener('input', function(e){
        pendingMath.q = e.target.value;
        var b = _el('btn-math-add');
        if (b) {
            var ok = (pendingMath.q || '').trim().length > 0;
            b.disabled = !ok;
            b.style.background = ok ? 'rgba(102,255,153,0.15)' : '#141414';
            b.style.borderColor = ok ? '#66ff99' : '#2a2a2a';
            b.style.color = ok ? '#66ff99' : '#444';
            b.style.cursor = ok ? 'pointer' : 'not-allowed';
        }
    });
    var latexTxt = _el('hl-math-latex'); if (latexTxt) latexTxt.addEventListener('input', function(e){ pendingMath.latex = e.target.value; });
    var aTxt = _el('hl-math-atxt'); if (aTxt) aTxt.addEventListener('input', function(e){ pendingMath.a = e.target.value; });
    var catSel = _el('hl-math-cat'); if (catSel) catSel.addEventListener('change', function(e){ pendingMath.category = e.target.value; });
    var voidSel = _el('hl-math-void'); if (voidSel) voidSel.addEventListener('change', function(e){ pendingMath.voidEnabled = !!e.target.checked; });

    var addBtn = _el('btn-math-add');
    if (addBtn) addBtn.addEventListener('click', function(){
        var q = (pendingMath.q || '').trim();
        if (!q) return;
        hlDraft.mathItems.push({
            id: _uid(),
            section: pendingMath.section || (hlDraft.chapters[0] ? hlDraft.chapters[0].name : 'Allgemein'),
            q: q,
            latex: (pendingMath.latex || '').trim(),
            a: (pendingMath.a || '').trim(),
            category: pendingMath.category || 'flashcards',
            voidEnabled: !!pendingMath.voidEnabled
        });
        pendingMath.q = '';
        pendingMath.latex = '';
        pendingMath.a = '';
        pendingMath.voidEnabled = true;
        mathTarget = 'question';
        _renderStagePanel();
    });

    var skipBtn = _el('btn-math-skip');
    if (skipBtn) skipBtn.addEventListener('click', function(){
        if (hlStage < STAGES.length - 1) {
            hlStage++;
            _renderStage();
        }
    });

    var list = _el('hl-math-list');
    hlDraft.mathItems.forEach(function(item, i){
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:9px;border:1px solid rgba(255,209,102,0.25);border-radius:6px;padding:8px;background:#14120b;font-size:0.76em;';
        var catOptions = MATH_TARGET_OPTIONS.map(function(o){ return '<option value="'+o.id+'"'+(item.category===o.id?' selected':'')+'>'+o.label+'</option>'; }).join('');
        row.innerHTML = [
            '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:5px;">',
              '<span style="color:#cdbd86;">'+_esc(item.section)+'</span>',
              '<button class="hl-math-del" data-idx="'+i+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;">&#x1F5D1;</button>',
            '</div>',
            '<label style="color:#bda76a;font-size:0.86em;">Equation / Prompt</label>',
            '<textarea class="hl-math-qe" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#f6db95;border-radius:3px;padding:4px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(item.q)+'</textarea>',
            '<label style="color:#8feaff;font-size:0.86em;">Canonical Math / LaTeX</label>',
            '<textarea class="hl-math-le" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid rgba(103,232,249,0.35);color:#c7f4ff;border-radius:3px;padding:4px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(item.latex||'')+'</textarea>',
            '<label style="color:#9fd8e3;font-size:0.86em;">Answer / Note</label>',
            '<textarea class="hl-math-ae" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#9fd8e3;border-radius:3px;padding:4px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(item.a||'')+'</textarea>',
            '<label style="color:#7d7899;font-size:0.8em;">Category</label>',
            '<select class="hl-math-cat-e" data-idx="'+i+'" style="width:100%;padding:5px;background:#111;border:1px solid rgba(255,209,102,0.35);color:#e8dbaf;border-radius:4px;font-size:0.82em;">'+catOptions+'</select>',
            '<label style="display:flex;align-items:center;gap:7px;color:#a7f3c3;font-size:0.78em;margin-top:4px;"><input class="hl-math-void-e" data-idx="'+i+'" type="checkbox" '+(item.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">In The Void</label>'
        ].join('');
        list.appendChild(row);
    });

    list.querySelectorAll('.hl-math-del').forEach(function(btn){
        btn.addEventListener('click', function(e){
            var idx = parseInt(e.target.dataset.idx);
            hlDraft.mathItems.splice(idx, 1);
            _renderStagePanel();
        });
    });
    list.querySelectorAll('.hl-math-qe').forEach(function(ta){
        ta.addEventListener('input', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.mathItems[idx]) hlDraft.mathItems[idx].q = e.target.value;
        });
    });
    list.querySelectorAll('.hl-math-le').forEach(function(ta){
        ta.addEventListener('input', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.mathItems[idx]) hlDraft.mathItems[idx].latex = e.target.value;
        });
    });
    list.querySelectorAll('.hl-math-ae').forEach(function(ta){
        ta.addEventListener('input', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.mathItems[idx]) hlDraft.mathItems[idx].a = e.target.value;
        });
    });
    list.querySelectorAll('.hl-math-cat-e').forEach(function(sel){
        sel.addEventListener('change', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.mathItems[idx]) hlDraft.mathItems[idx].category = e.target.value;
        });
    });
    list.querySelectorAll('.hl-math-void-e').forEach(function(cb){
        cb.addEventListener('change', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.mathItems[idx]) hlDraft.mathItems[idx].voidEnabled = !!e.target.checked;
        });
    });
}

function _renderPanelImages(panel) {
    panel.innerHTML=[
        '<div style="padding:12px 14px;border-bottom:1px solid #1a1a2e;">',
          '<p style="margin:0 0 4px;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Bild-Bibliothek ('+hlDraft.images.length+')</p>',
          '<p style="margin:0;font-size:0.78em;color:#666;">Rechteck auf dem PDF aufziehen &#8594; Bild wird gespeichert.</p>',
        '</div>',
        '<div id="hl-images-list" style="flex:1;overflow-y:auto;padding:10px;"></div>',
    ].join('');
    var list=_el('hl-images-list');
    if(!hlDraft.images.length){
        list.innerHTML='<p style="color:#444;font-size:0.8em;text-align:center;margin-top:28px;">Noch keine Bilder erfasst.</p>';
        return;
    }
    hlDraft.images.forEach(function(img){
        var div=document.createElement('div');
        div.style.cssText='margin-bottom:10px;border:1px solid #2a2a3a;border-radius:6px;padding:8px;background:#111;';
        div.innerHTML=[
            '<img src="'+img.dataURL+'" style="width:100%;max-height:80px;object-fit:contain;border-radius:3px;margin-bottom:5px;">',
            '<input type="text" class="hl-img-label" data-id="'+img.id+'" value="'+_esc(img.label)+'" placeholder="Beschriftung..." style="width:100%;padding:4px 7px;background:#0a0a12;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.78em;box-sizing:border-box;">',
            '<label style="display:flex;align-items:center;gap:6px;color:#a7f3c3;font-size:0.76em;margin-top:4px;"><input type="checkbox" class="hl-img-void" data-id="'+img.id+'" '+(img.voidEnabled===true?'checked':'')+' style="accent-color:#4cd137;">Add image object to The Void</label>',
            '<button class="hl-img-del" data-id="'+img.id+'" style="margin-top:4px;width:100%;background:none;border:1px solid #f66;color:#f66;border-radius:4px;cursor:pointer;font-size:0.78em;padding:2px 0;">Entfernen</button>',
        ].join('');
        list.appendChild(div);
    });
    list.querySelectorAll('.hl-img-label').forEach(function(inp){
        inp.addEventListener('input',function(e){
            var img=hlDraft.images.find(function(x){return String(x.id)===e.target.dataset.id;});
            if(img) img.label=e.target.value;
        });
    });
    list.querySelectorAll('.hl-img-del').forEach(function(btn){
        btn.addEventListener('click',function(e){
            var id=e.target.dataset.id;
            hlDraft.images=hlDraft.images.filter(function(x){return String(x.id)!==id;});
            _renderStagePanel();
        });
    });
    list.querySelectorAll('.hl-img-void').forEach(function(inp){
        inp.addEventListener('change', function(e){
            var img = hlDraft.images.find(function(x){ return String(x.id) === String(e.target.dataset.id); });
            if (img) img.voidEnabled = !!e.target.checked;
        });
    });
}

// ---------------------------------------------------------------------------
// Chapters panel
// ---------------------------------------------------------------------------
function _renderPanelChapters(panel) {
    panel.innerHTML=[
        '<div style="padding:12px 14px;border-bottom:1px solid #1a1a2e;">',
          '<p style="margin:0 0 4px;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Kapitel ('+hlDraft.chapters.length+')</p>',
          '<p style="margin:0;font-size:0.78em;color:#666;">Ueberschriften im PDF markieren &#8594; werden zu Sections auf der Weltkarte.</p>',
        '</div>',
        '<div id="hl-chapters-list" style="flex:1;overflow-y:auto;padding:10px;"></div>',
    ].join('');
    var list=_el('hl-chapters-list');
    if(!hlDraft.chapters.length){
        list.innerHTML='<p style="color:#444;font-size:0.8em;text-align:center;margin-top:28px;">Noch keine Kapitel markiert.</p>';
        return;
    }
    hlDraft.chapters.forEach(function(ch){
        var div=document.createElement('div');
        div.style.cssText='margin-bottom:8px;border:1px solid rgba(212,168,67,0.5);border-radius:5px;padding:7px 9px;background:rgba(212,168,67,0.1);display:flex;align-items:center;gap:6px;';
        div.innerHTML='<span style="color:#d4a843;font-size:0.83em;flex:1;word-break:break-word;">'+_esc(ch.name)+'</span>'
            +'<button class="hl-ch-del" data-id="'+ch.id+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;padding:0 3px;flex-shrink:0;">&#x1F5D1;</button>';
        list.appendChild(div);
    });
    list.querySelectorAll('.hl-ch-del').forEach(function(btn){
        btn.addEventListener('click',function(e){
            var id=e.target.dataset.id;
            hlDraft.chapters=hlDraft.chapters.filter(function(x){return String(x.id)!==id;});
            _renderStagePanel();
        });
    });
}

// ---------------------------------------------------------------------------
// Content panel (Stage 3)
// ---------------------------------------------------------------------------
function _renderPanelContent(panel) {
    var chapters=hlDraft.chapters.map(function(c){return c.name;});
    if(!activeChapter&&chapters.length) activeChapter=chapters[0];
    var chOpts=chapters.map(function(c){return '<option value="'+_esc(c)+'"'+(c===activeChapter?' selected':'')+'>'+_esc(c)+'</option>';}).join('');
    var texts=hlDraft.chapterTexts[activeChapter]||[];
    panel.innerHTML=[
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;">',
          '<p style="margin:0 0 4px;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Aktives Kapitel</p>',
          '<select id="hl-ch-sel" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>',
          '<p style="margin:5px 0 0;font-size:0.75em;color:#555;">'+texts.length+' Abschnitt(e) fuer "'+_esc(activeChapter)+'"</p>',
        '</div>',
        '<div id="hl-content-list" style="flex:1;overflow-y:auto;padding:8px 10px;"></div>',
    ].join('');
    var sel=_el('hl-ch-sel');
    if(sel) sel.addEventListener('change',function(e){ activeChapter=e.target.value; _renderStagePanel(); });
    var list=_el('hl-content-list');
    if(!texts.length){
        list.innerHTML='<p style="color:#444;font-size:0.8em;text-align:center;margin-top:18px;">Noch keinen Text markiert.</p>';
        return;
    }
    texts.forEach(function(txt,i){
        var div=document.createElement('div');
        div.style.cssText='margin-bottom:7px;border:1px solid rgba(162,155,254,0.3);border-radius:5px;padding:6px 8px;background:rgba(162,155,254,0.08);display:flex;align-items:flex-start;gap:5px;';
        div.innerHTML='<span style="color:#c0b8f8;font-size:0.76em;flex:1;line-height:1.5;word-break:break-word;">'+_esc(txt.slice(0,160))+(txt.length>160?'&hellip;':'')+'</span>'
            +'<button class="hl-ct-del" data-idx="'+i+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;padding:0 2px;flex-shrink:0;">&#x1F5D1;</button>';
        list.appendChild(div);
    });
    list.querySelectorAll('.hl-ct-del').forEach(function(btn){
        btn.addEventListener('click',function(e){
            var idx=parseInt(e.target.dataset.idx);
            hlDraft.chapterTexts[activeChapter].splice(idx,1);
            _renderStagePanel();
        });
    });
}

// ---------------------------------------------------------------------------
// Q/A panel shared by Flashcard (stage 4) and Quiz (stage 5)
// ---------------------------------------------------------------------------
function _renderPanelQA(panel,target) {
    var stageId = (STAGES[hlStage] && STAGES[hlStage].id) ? STAGES[hlStage].id : '';
    var qaStoreKey = stageId === 'quiz' ? 'quizzes' : (stageId === 'flash' ? 'flashcards' : target);
    if (qaStoreKey !== 'flashcards' && qaStoreKey !== 'quizzes') qaStoreKey = target === 'quizzes' ? 'quizzes' : 'flashcards';
    if (pendingQAMode !== qaStoreKey) {
        var keepSection = pendingQA && pendingQA.section ? pendingQA.section : '';
        pendingQA = _emptyPending();
        pendingQA.section = keepSection;
        qaTarget = 'question';
        pendingQAMode = qaStoreKey;
    }

    var items=Array.isArray(hlDraft[qaStoreKey]) ? hlDraft[qaStoreKey] : [];
    var chapters=hlDraft.chapters.map(function(c){return c.name;});
    if(!pendingQA.section&&chapters.length) pendingQA.section=chapters[0];
    var chOpts=chapters.map(function(c){return '<option value="'+_esc(c)+'"'+(c===pendingQA.section?' selected':'')+'>'+_esc(c)+'</option>';}).join('');
    var isQ=qaTarget==='question';
    var qImg=pendingQA.q.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.q.imageId);}):null;
    var aImg=pendingQA.a.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.a.imageId);}):null;
    var canAdd=(pendingQA.q.text||qImg)&&(pendingQA.a.text||aImg);
    var label=qaStoreKey==='flashcards'?'Lernkarte(n)':'Quiz-Frage(n)';
    var flashSources = qaStoreKey==='quizzes'
        ? hlDraft.flashcards.filter(function(fc){ return fc.section===pendingQA.section; })
        : [];

    panel.innerHTML=[
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;display:flex;flex-direction:column;gap:7px;">',
          '<p style="margin:0;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Kapitel</p>',
          '<select id="hl-qa-ch" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>',
                    (qaStoreKey==='quizzes'
                        ? (flashSources.length
                                ? [
                                        '<p style="margin:4px 0 2px;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Aus Flashcards uebernehmen:</p>',
                                        '<div id="hl-quiz-src-list" style="max-height:100px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;"></div>'
                                    ].join('')
                                : '<p style="margin:2px 0 0;font-size:0.74em;color:#555;">Keine Flashcards in diesem Kapitel zum Uebernehmen.</p>')
                        : ''),
          '<div style="display:flex;gap:5px;">',
            '<button id="btn-qa-q" style="flex:1;padding:6px;border-radius:4px;cursor:pointer;font-size:0.82em;font-weight:bold;'
              +'background:'+(isQ?'rgba(179,157,254,0.35)':'#181820')
              +';border:2px solid '+(isQ?'#b39dfe':'#333')
              +';color:'+(isQ?'#c4b5fd':'#555')+';">&#128161; Frage</button>',
            '<button id="btn-qa-a" style="flex:1;padding:6px;border-radius:4px;cursor:pointer;font-size:0.82em;font-weight:bold;'
              +'background:'+(!isQ?'rgba(103,232,249,0.22)':'#181820')
              +';border:2px solid '+(!isQ?'#67e8f9':'#333')
              +';color:'+(!isQ?'#67e8f9':'#555')+';">&#128161; Antwort</button>',
          '</div>',
          '<div style="background:#0c0c18;border-radius:5px;padding:7px;font-size:0.75em;">',
            '<p style="margin:0 0 3px;color:#b39dfe;font-weight:bold;">Frage</p>',
            qImg?'<img src="'+qImg.dataURL+'" style="max-width:100%;max-height:44px;object-fit:contain;border-radius:2px;margin-bottom:2px;display:block;">':'',
                        '<textarea id="hl-pending-q" rows="2" placeholder="Frage tippen (falls Markierung nicht klappt)..." style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#d0c8f8;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(pendingQA.q.text)+'</textarea>',
            '<button id="btn-clr-q" style="margin-top:3px;padding:1px 7px;background:none;border:1px solid #333;color:#555;border-radius:3px;cursor:pointer;font-size:0.72em;">&#x2715; leeren</button>',
          '</div>',
          '<div style="background:#0c0c18;border-radius:5px;padding:7px;font-size:0.75em;">',
            '<p style="margin:0 0 3px;color:#67e8f9;font-weight:bold;">Antwort</p>',
            aImg?'<img src="'+aImg.dataURL+'" style="max-width:100%;max-height:44px;object-fit:contain;border-radius:2px;margin-bottom:2px;display:block;">':'',
                        '<textarea id="hl-pending-a" rows="2" placeholder="Antwort tippen (falls Markierung nicht klappt)..." style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#a0e8f8;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(pendingQA.a.text)+'</textarea>',
            '<button id="btn-clr-a" style="margin-top:3px;padding:1px 7px;background:none;border:1px solid #333;color:#555;border-radius:3px;cursor:pointer;font-size:0.72em;">&#x2715; leeren</button>',
          '</div>',
          hlDraft.images.length?'<div><p style="margin:0 0 4px;font-size:0.7em;color:#666;">Bild als Frage/Antwort:</p><div id="hl-qa-imglib" style="display:flex;flex-wrap:wrap;gap:4px;"></div></div>':'',
          '<label style="display:flex;align-items:center;gap:8px;font-size:0.78em;color:#a7f3c3;"><input id="hl-qa-void" type="checkbox" '+(pendingQA.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">Add this object to The Void</label>',
          '<button id="btn-qa-add" '+(canAdd?'':'disabled')+' style="padding:7px;background:'+(canAdd?'rgba(102,255,153,0.15)':'#141414')+';border:1px solid '+(canAdd?'#66ff99':'#2a2a2a')+';color:'+(canAdd?'#66ff99':'#444')+';border-radius:5px;cursor:'+(canAdd?'pointer':'not-allowed')+';font-weight:bold;font-size:0.88em;">+ Hinzufuegen</button>',
        '</div>',
        '<div id="hl-qa-list" style="flex:1;overflow-y:auto;padding:10px;">',
          '<p style="margin:0 0 6px;font-size:0.7em;color:#555;text-transform:uppercase;letter-spacing:1px;">'+items.length+' '+label+'</p>',
        '</div>',
    ].join('');

    var chSel=_el('hl-qa-ch');
    if(chSel) chSel.addEventListener('change',function(e){ pendingQA.section=e.target.value; _renderStagePanel(); });
    var bq=_el('btn-qa-q'); if(bq) bq.addEventListener('click',function(){ qaTarget='question'; _renderStagePanel(); });
    var ba=_el('btn-qa-a'); if(ba) ba.addEventListener('click',function(){ qaTarget='answer';   _renderStagePanel(); });
    var bcq=_el('btn-clr-q'); if(bcq) bcq.addEventListener('click',function(){ pendingQA.q={text:'',imageId:null}; _renderStagePanel(); });
    var bca=_el('btn-clr-a'); if(bca) bca.addEventListener('click',function(){ pendingQA.a={text:'',imageId:null}; _renderStagePanel(); });
    var pQ=_el('hl-pending-q');
    var pA=_el('hl-pending-a');
    function _refreshAddBtnState(){
        var add=_el('btn-qa-add');
        if(!add) return;
        var qImgNow=pendingQA.q.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.q.imageId);}):null;
        var aImgNow=pendingQA.a.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.a.imageId);}):null;
        var ok=((pendingQA.q.text||'').trim()||qImgNow)&&((pendingQA.a.text||'').trim()||aImgNow);
        add.disabled=!ok;
        add.style.background=ok?'rgba(102,255,153,0.15)':'#141414';
        add.style.borderColor=ok?'#66ff99':'#2a2a2a';
        add.style.color=ok?'#66ff99':'#444';
        add.style.cursor=ok?'pointer':'not-allowed';
    }
    if(pQ) pQ.addEventListener('input',function(e){ pendingQA.q.text=e.target.value; _refreshAddBtnState(); });
    if(pA) pA.addEventListener('input',function(e){ pendingQA.a.text=e.target.value; _refreshAddBtnState(); });
    var qVoid = _el('hl-qa-void'); if (qVoid) qVoid.addEventListener('change', function(e){ pendingQA.voidEnabled = !!e.target.checked; });

    var imgLib=_el('hl-qa-imglib');
    if(imgLib){
        hlDraft.images.forEach(function(img){
            var thumb=document.createElement('div');
            thumb.style.cssText='cursor:pointer;border:1px solid #333;border-radius:3px;overflow:hidden;';
            thumb.innerHTML='<img src="'+img.dataURL+'" style="width:48px;height:36px;object-fit:contain;" title="'+_esc(img.label||'Bild')+'">';
            thumb.addEventListener('click',function(){
                if(qaTarget==='question') pendingQA.q.imageId=img.id;
                else pendingQA.a.imageId=img.id;
                _renderStagePanel();
            });
            imgLib.appendChild(thumb);
        });
    }

    var srcList=_el('hl-quiz-src-list');
    if(srcList){
        flashSources.forEach(function(fc){
            var btn=document.createElement('button');
            btn.style.cssText='padding:4px 8px;background:#111;border:1px solid rgba(103,232,249,0.35);color:#a0e8f8;border-radius:4px;cursor:pointer;font-size:0.75em;text-align:left;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            btn.title=(fc.q && fc.q.text ? fc.q.text : '[Bild]');
            btn.textContent='🟡 '+((fc.q && fc.q.text ? fc.q.text : '[Bild]').slice(0,55));
            btn.addEventListener('click',function(){
                hlDraft.quizzes.push({
                    id:_uid(),
                    section:pendingQA.section||(hlDraft.chapters[0]?hlDraft.chapters[0].name:'Allgemein'),
                    q:{text:(fc.q&&fc.q.text)||'',imageData:(fc.q&&fc.q.imageData)||null},
                    a:{text:(fc.a&&fc.a.text)||'',imageData:(fc.a&&fc.a.imageData)||null},
                    voidEnabled: fc.voidEnabled !== false,
                });
                _renderStagePanel();
            });
            srcList.appendChild(btn);
        });
    }

    var addBtn=_el('btn-qa-add');
    if(addBtn){
        addBtn.addEventListener('click',function(){
            var qImgObjNow=pendingQA.q.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.q.imageId);}):null;
            var aImgObjNow=pendingQA.a.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.a.imageId);}):null;
            var qOk=((pendingQA.q.text||'').trim()||qImgObjNow);
            var aOk=((pendingQA.a.text||'').trim()||aImgObjNow);
            if(!qOk || !aOk) return;
            var qImgObj=pendingQA.q.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.q.imageId);}):null;
            var aImgObj=pendingQA.a.imageId?hlDraft.images.find(function(x){return String(x.id)===String(pendingQA.a.imageId);}):null;
            hlDraft[qaStoreKey].push({
                id:_uid(),
                section:pendingQA.section||(hlDraft.chapters[0]?hlDraft.chapters[0].name:'Allgemein'),
                q:{text:pendingQA.q.text,imageData:qImgObj?qImgObj.dataURL:null},
                a:{text:pendingQA.a.text,imageData:aImgObj?aImgObj.dataURL:null},
                voidEnabled: pendingQA.voidEnabled !== false,
            });
            pendingQA={section:pendingQA.section,q:{text:'',imageId:null},a:{text:'',imageId:null},voidEnabled:true};
            _renderStagePanel();
        });
    }

    var listEl=_el('hl-qa-list');
    items.forEach(function(item,i){
        var div=document.createElement('div');
        div.style.cssText='margin-bottom:9px;border:1px solid rgba(162,155,254,0.18);border-radius:6px;padding:8px;background:#0f0f1c;font-size:0.76em;';
        div.innerHTML=[
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px;">',
              '<span style="color:#666;font-size:0.9em;">'+_esc(item.section)+'</span>',
              '<button class="hl-qa-del" data-target="'+qaStoreKey+'" data-idx="'+i+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;">&#x1F5D1;</button>',
            '</div>',
            '<p style="margin:0 0 2px;color:#b39dfe;font-weight:bold;font-size:0.9em;">&#10067;</p>',
            item.q.imageData?'<img src="'+item.q.imageData+'" style="max-width:100%;max-height:40px;object-fit:contain;border-radius:2px;margin-bottom:2px;display:block;">':'',
            '<textarea class="hl-qa-qt" data-target="'+qaStoreKey+'" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#d0c8f8;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(item.q.text)+'</textarea>',
            '<p style="margin:4px 0 2px;color:#67e8f9;font-weight:bold;font-size:0.9em;">&#128161;</p>',
            item.a.imageData?'<img src="'+item.a.imageData+'" style="max-width:100%;max-height:40px;object-fit:contain;border-radius:2px;margin-bottom:2px;display:block;">':'',
            '<textarea class="hl-qa-at" data-target="'+qaStoreKey+'" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid #2a2a3a;color:#a0e8f8;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(item.a.text)+'</textarea>',
            '<label style="display:flex;align-items:center;gap:7px;color:#a7f3c3;font-size:0.78em;margin-top:4px;"><input class="hl-qa-void-e" data-target="'+qaStoreKey+'" data-idx="'+i+'" type="checkbox" '+(item.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">In The Void</label>',
        ].join('');
        listEl.appendChild(div);
    });
    listEl.querySelectorAll('.hl-qa-del').forEach(function(btn){
        btn.addEventListener('click',function(e){
            hlDraft[e.target.dataset.target].splice(parseInt(e.target.dataset.idx),1);
            _renderStagePanel();
        });
    });
    listEl.querySelectorAll('.hl-qa-qt').forEach(function(ta){
        ta.addEventListener('input',function(e){ hlDraft[e.target.dataset.target][parseInt(e.target.dataset.idx)].q.text=e.target.value; });
    });
    listEl.querySelectorAll('.hl-qa-at').forEach(function(ta){
        ta.addEventListener('input',function(e){ hlDraft[e.target.dataset.target][parseInt(e.target.dataset.idx)].a.text=e.target.value; });
    });
    listEl.querySelectorAll('.hl-qa-void-e').forEach(function(cb){
        cb.addEventListener('change', function(e){
            var t = e.target.dataset.target;
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft[t] && hlDraft[t][idx]) hlDraft[t][idx].voidEnabled = !!e.target.checked;
        });
    });
}

// ---------------------------------------------------------------------------
// Exam panel (Stage 6)
// ---------------------------------------------------------------------------
function _renderPanelExam(panel) {
    var chapters=hlDraft.chapters.map(function(c){return c.name;});
    if(!activeChapter&&chapters.length) activeChapter=chapters[0];
    var chOpts=chapters.map(function(c){return '<option value="'+_esc(c)+'"'+(c===activeChapter?' selected':'')+'>'+_esc(c)+'</option>';}).join('');
    var sources=[].concat(
        hlDraft.flashcards.filter(function(fc){return fc.section===activeChapter;}).map(function(fc){return Object.assign({},fc,{_type:'flash'});}),
        hlDraft.quizzes.filter(function(q){return q.section===activeChapter;}).map(function(q){return Object.assign({},q,{_type:'quiz'});})
    );
    var exams=hlDraft.exams.filter(function(e){return e.section===activeChapter;});
    panel.innerHTML=[
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;display:flex;flex-direction:column;gap:6px;">',
          '<p style="margin:0;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Kapitel</p>',
          '<select id="hl-ex-ch" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>',
          sources.length?[
            '<p style="margin:4px 0 2px;font-size:0.7em;color:#666;text-transform:uppercase;">Aus Lernkarten/Quiz uebernehmen:</p>',
            '<div id="hl-ex-src" style="max-height:100px;overflow-y:auto;display:flex;flex-direction:column;gap:3px;"></div>',
          ].join(''):'<p style="font-size:0.78em;color:#555;margin:4px 0;">Keine Lernkarten/Quiz fuer dieses Kapitel vorhanden.</p>',
        '</div>',
        '<div id="hl-ex-list" style="flex:1;overflow-y:auto;padding:10px;">',
          '<p style="margin:0 0 6px;font-size:0.7em;color:#555;text-transform:uppercase;letter-spacing:1px;">'+exams.length+' Pruefungsaufgabe(n)</p>',
        '</div>',
    ].join('');

    var chSel=_el('hl-ex-ch');
    if(chSel) chSel.addEventListener('change',function(e){ activeChapter=e.target.value; _renderStagePanel(); });

    var srcEl=_el('hl-ex-src');
    if(srcEl){
        sources.forEach(function(src){
            var btn=document.createElement('button');
            btn.style.cssText='padding:4px 8px;background:#111;border:1px solid rgba(220,50,50,0.3);color:#ffb8b8;border-radius:4px;cursor:pointer;font-size:0.75em;text-align:left;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
            btn.title=(src.q.text||'[Bild]');
            btn.textContent=(src._type==='flash'?'🟡 ':'🟢 ')+(src.q.text||'[Bild]').slice(0,55);
            btn.addEventListener('click',function(){
                hlDraft.exams.push({id:_uid(),section:activeChapter,question:src.q.text||'',answer:src.a.text||'',elaboration:'',qImageData:src.q.imageData||null,aImageData:src.a.imageData||null,voidEnabled:true});
                _renderStagePanel();
            });
            srcEl.appendChild(btn);
        });
    }

    var listEl=_el('hl-ex-list');
    exams.forEach(function(ex,i){
        var globalIdx=hlDraft.exams.indexOf(ex);
        var div=document.createElement('div');
        div.style.cssText='margin-bottom:10px;border:1px solid rgba(220,50,50,0.3);border-radius:6px;padding:9px;background:#100808;font-size:0.76em;';
        div.innerHTML=[
            '<div style="display:flex;justify-content:space-between;margin-bottom:5px;">',
              '<span style="color:#ff9999;font-weight:bold;">Aufgabe '+(i+1)+'</span>',
              '<button class="hl-ex-del" data-gidx="'+globalIdx+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;">&#x1F5D1;</button>',
            '</div>',
            ex.qImageData?'<img src="'+ex.qImageData+'" style="max-width:100%;max-height:40px;object-fit:contain;border-radius:2px;margin-bottom:4px;display:block;">':'',
            '<label style="color:#ff9999;font-size:0.9em;">Frage:</label>',
            '<textarea class="hl-ex-q" data-gidx="'+globalIdx+'" rows="2" style="width:100%;background:#0a0a0a;border:1px solid #2a1a1a;color:#ffb8b8;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;margin-bottom:4px;">'+_esc(ex.question)+'</textarea>',
            '<label style="color:#ff9999;font-size:0.9em;">Ausfuehrliche Antwort:</label>',
            '<textarea class="hl-ex-el" data-gidx="'+globalIdx+'" rows="4" style="width:100%;background:#0a0a0a;border:1px solid #2a1a1a;color:#ffe0e0;border-radius:3px;padding:3px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(ex.elaboration||ex.answer)+'</textarea>',
            '<label style="display:flex;align-items:center;gap:7px;color:#a7f3c3;font-size:0.78em;margin-top:4px;"><input class="hl-ex-void" data-gidx="'+globalIdx+'" type="checkbox" '+(ex.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">In The Void</label>',
        ].join('');
        listEl.appendChild(div);
    });
    listEl.querySelectorAll('.hl-ex-del').forEach(function(btn){
        btn.addEventListener('click',function(e){
            var gidx=parseInt(e.target.dataset.gidx);
            hlDraft.exams.splice(gidx,1);
            _renderStagePanel();
        });
    });
    listEl.querySelectorAll('.hl-ex-q').forEach(function(ta){
        ta.addEventListener('input',function(e){ var g=parseInt(e.target.dataset.gidx); if(hlDraft.exams[g]) hlDraft.exams[g].question=e.target.value; });
    });
    listEl.querySelectorAll('.hl-ex-el').forEach(function(ta){
        ta.addEventListener('input',function(e){ var g=parseInt(e.target.dataset.gidx); if(hlDraft.exams[g]) hlDraft.exams[g].elaboration=e.target.value; });
    });
    listEl.querySelectorAll('.hl-ex-void').forEach(function(cb){
        cb.addEventListener('change', function(e){ var g=parseInt(e.target.dataset.gidx); if(hlDraft.exams[g]) hlDraft.exams[g].voidEnabled = !!e.target.checked; });
    });
}

// ---------------------------------------------------------------------------
// Tasks panel (Stage 7)
// ---------------------------------------------------------------------------
function _renderPanelTasks(panel) {
    var chapters=hlDraft.chapters.map(function(c){return c.name;});
    if(!activeChapter && chapters.length) activeChapter=chapters[0];
    var chOpts=chapters.map(function(c){return '<option value="'+_esc(c)+'"'+(c===activeChapter?' selected':'')+'>'+_esc(c)+'</option>';}).join('');
    var currentTasks=(hlDraft.tasks||[]).filter(function(t){return t.section===activeChapter;});
    var allTasks=(hlDraft.tasks||[]);

    panel.innerHTML=[
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;display:flex;flex-direction:column;gap:7px;">',
          '<p style="margin:0;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Tasks vor dem Veroeffentlichen</p>',
          chapters.length
            ? ('<select id="hl-task-ch" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>')
            : '<p style="font-size:0.78em;color:#666;margin:0;">Erst Kapitel im vorherigen Schritt markieren.</p>',
          '<p style="margin:0;font-size:0.75em;color:#666;">Format: [ ] Task Text (oder einfach Text eingeben).</p>',
                    '<label style="display:flex;align-items:center;gap:7px;font-size:0.78em;color:#a7f3c3;"><input id="hl-task-void" type="checkbox" checked style="accent-color:#4cd137;">Add new tasks to The Void</label>',
          '<div style="display:flex;gap:6px;">',
            '<input id="hl-task-text" type="text" placeholder="[ ] Read section summary" style="flex:1;padding:6px 8px;background:#111;border:1px solid #2a2a3a;color:#ddd;border-radius:4px;font-size:0.82em;box-sizing:border-box;">',
            '<button id="btn-task-add" style="padding:6px 10px;background:rgba(102,255,153,0.15);border:1px solid #66ff99;color:#66ff99;border-radius:4px;cursor:pointer;font-size:0.8em;">+ Add</button>',
          '</div>',
          '<p style="margin:0;font-size:0.74em;color:#555;">Gesamt: '+allTasks.length+' Task(s)</p>',
        '</div>',
        '<div id="hl-task-list" style="flex:1;overflow-y:auto;padding:10px;"></div>',
    ].join('');

    var chSel=_el('hl-task-ch');
    if(chSel) chSel.addEventListener('change', function(e){ activeChapter=e.target.value; _renderStagePanel(); });

    var addBtn=_el('btn-task-add');
    if(addBtn) addBtn.addEventListener('click', function(){
        if(!activeChapter){ alert('Bitte zuerst ein Kapitel auswaehlen.'); return; }
        var inp=_el('hl-task-text');
        var raw=(inp && inp.value ? inp.value : '').trim();
        if(!raw) return;
        var cleaned=raw.replace(/^\[(?:\s|x|X)?\]\s*/, '').trim();
        if(!cleaned) return;
        var addToVoid = !!(_el('hl-task-void') && _el('hl-task-void').checked);
        hlDraft.tasks.push({ id:_uid(), section:activeChapter, text:cleaned, completed:false, voidEnabled:addToVoid });
        if(inp) inp.value='';
        _renderStagePanel();
    });

    var taskList=_el('hl-task-list');
    if(!taskList) return;
    if(!currentTasks.length){
        taskList.innerHTML='<p style="color:#444;font-size:0.8em;text-align:center;margin-top:18px;">Keine Tasks fuer dieses Kapitel.</p>';
        return;
    }

    currentTasks.forEach(function(task){
        var gidx=hlDraft.tasks.indexOf(task);
        var row=document.createElement('div');
        row.style.cssText='margin-bottom:8px;border:1px solid rgba(102,255,153,0.25);border-radius:6px;padding:7px 8px;background:rgba(102,255,153,0.06);display:flex;align-items:center;gap:7px;';
        row.innerHTML=[
            '<input class="hl-task-done" data-gidx="'+gidx+'" type="checkbox" '+(task.completed?'checked':'')+' style="accent-color:#66ff99;cursor:pointer;">',
            '<input class="hl-task-edit" data-gidx="'+gidx+'" type="text" value="'+_esc(task.text)+'" style="flex:1;padding:4px 6px;background:#0a0a12;border:1px solid #2a2a3a;color:#ddd;border-radius:4px;font-size:0.8em;box-sizing:border-box;">',
            '<input class="hl-task-void" data-gidx="'+gidx+'" type="checkbox" '+(task.voidEnabled===false?'':'checked')+' title="In The Void" style="accent-color:#4cd137;cursor:pointer;">',
            '<button class="hl-task-del" data-gidx="'+gidx+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;">&#x1F5D1;</button>',
        ].join('');
        taskList.appendChild(row);
    });

    taskList.querySelectorAll('.hl-task-done').forEach(function(cb){
        cb.addEventListener('change', function(e){
            var g=parseInt(e.target.dataset.gidx);
            if(hlDraft.tasks[g]) hlDraft.tasks[g].completed=!!e.target.checked;
        });
    });
    taskList.querySelectorAll('.hl-task-edit').forEach(function(inp){
        inp.addEventListener('input', function(e){
            var g=parseInt(e.target.dataset.gidx);
            if(!hlDraft.tasks[g]) return;
            hlDraft.tasks[g].text=e.target.value.replace(/^\[(?:\s|x|X)?\]\s*/, '').trimStart();
        });
    });
    taskList.querySelectorAll('.hl-task-void').forEach(function(cb){
        cb.addEventListener('change', function(e){
            var g=parseInt(e.target.dataset.gidx);
            if(hlDraft.tasks[g]) hlDraft.tasks[g].voidEnabled=!!e.target.checked;
        });
    });
    taskList.querySelectorAll('.hl-task-del').forEach(function(btn){
        btn.addEventListener('click', function(e){
            var g=parseInt(e.target.dataset.gidx);
            if(isNaN(g)||!hlDraft.tasks[g]) return;
            hlDraft.tasks.splice(g,1);
            _renderStagePanel();
        });
    });
}

// ---------------------------------------------------------------------------
// Reminders panel (Stage 9)
// ---------------------------------------------------------------------------
function _renderPanelReminders(panel) {
    var chapters = hlDraft.chapters.map(function(c){ return c.name; });
    if(!activeChapter && chapters.length) activeChapter = chapters[0];
    if(!pendingReminder.section && activeChapter) pendingReminder.section = activeChapter;
    var chOpts = chapters.map(function(c){ return '<option value="'+_esc(c)+'"'+(c===pendingReminder.section?' selected':'')+'>'+_esc(c)+'</option>'; }).join('');
    var imgOptions = ['<option value="">Ohne Bild</option>'].concat(
        hlDraft.images.map(function(img, i){
            var label = (img.label || ('Bild '+(i+1))).slice(0, 36);
            return '<option value="'+_esc(String(img.id))+'"'+(String(img.id)===String(pendingReminder.imageId)?' selected':'')+'>'+_esc(label)+'</option>';
        })
    ).join('');
    var canAdd = (pendingReminder.text || '').trim().length > 0;

    panel.innerHTML = [
        '<div style="padding:10px 12px;border-bottom:1px solid #1a1a2e;display:flex;flex-direction:column;gap:7px;">',
          '<p style="margin:0;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:1px;">Wichtige Merker fuers Endless Scroller System</p>',
          chapters.length
            ? ('<select id="hl-reminder-ch" style="width:100%;padding:5px;background:#111;border:1px solid #2a2a3a;color:#bbb;border-radius:4px;font-size:0.82em;">'+chOpts+'</select>')
            : '<p style="font-size:0.78em;color:#666;margin:0;">Erst Kapitel markieren.</p>',
          '<textarea id="hl-reminder-text" rows="3" placeholder="Wichtige Notiz / Kernidee..." style="width:100%;background:#0a0a12;border:1px solid rgba(76,209,55,0.35);color:#c9ffd8;border-radius:3px;padding:5px 6px;font-size:0.9em;box-sizing:border-box;resize:vertical;">'+_esc(pendingReminder.text||'')+'</textarea>',
                    '<label style="display:flex;align-items:center;gap:7px;font-size:0.78em;color:#a7f3c3;"><input id="hl-reminder-void" type="checkbox" '+(pendingReminder.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">Add this object to The Void</label>',
          '<div style="display:flex;gap:6px;align-items:center;">',
            '<select id="hl-reminder-img" style="flex:1;padding:5px;background:#111;border:1px solid rgba(76,209,55,0.35);color:#c9ffd8;border-radius:4px;font-size:0.82em;">'+imgOptions+'</select>',
            '<button id="btn-reminder-add" '+(canAdd?'':'disabled')+' style="padding:7px 10px;background:'+(canAdd?'rgba(102,255,153,0.15)':'#141414')+';border:1px solid '+(canAdd?'#66ff99':'#2a2a2a')+';color:'+(canAdd?'#66ff99':'#444')+';border-radius:5px;cursor:'+(canAdd?'pointer':'not-allowed')+';font-weight:bold;font-size:0.84em;">+ Add</button>',
          '</div>',
        '</div>',
        '<div id="hl-reminder-list" style="flex:1;overflow-y:auto;padding:10px;">',
          '<p style="margin:0 0 6px;font-size:0.7em;color:#555;text-transform:uppercase;letter-spacing:1px;">'+(hlDraft.reminders||[]).length+' Reminder(s)</p>',
        '</div>'
    ].join('');

    var chSel = _el('hl-reminder-ch');
    if (chSel) chSel.addEventListener('change', function(e){
        pendingReminder.section = e.target.value;
        activeChapter = e.target.value;
    });
    var txt = _el('hl-reminder-text');
    if (txt) txt.addEventListener('input', function(e){
        pendingReminder.text = e.target.value;
        var b = _el('btn-reminder-add');
        if (b) {
            var ok = (pendingReminder.text || '').trim().length > 0;
            b.disabled = !ok;
            b.style.background = ok ? 'rgba(102,255,153,0.15)' : '#141414';
            b.style.borderColor = ok ? '#66ff99' : '#2a2a2a';
            b.style.color = ok ? '#66ff99' : '#444';
            b.style.cursor = ok ? 'pointer' : 'not-allowed';
        }
    });
    var imgSel = _el('hl-reminder-img');
    if (imgSel) imgSel.addEventListener('change', function(e){
        pendingReminder.imageId = e.target.value || null;
    });
    var remVoidSel = _el('hl-reminder-void');
    if (remVoidSel) remVoidSel.addEventListener('change', function(e){ pendingReminder.voidEnabled = !!e.target.checked; });

    var addBtn = _el('btn-reminder-add');
    if (addBtn) addBtn.addEventListener('click', function(){
        var text = (pendingReminder.text || '').trim();
        if (!text) return;
        hlDraft.reminders.push({
            id: _uid(),
            section: pendingReminder.section || activeChapter || (hlDraft.chapters[0] ? hlDraft.chapters[0].name : 'Allgemein'),
            text: text,
            imageId: pendingReminder.imageId || null,
            voidEnabled: pendingReminder.voidEnabled !== false
        });
        pendingReminder.text = '';
        pendingReminder.imageId = null;
        pendingReminder.voidEnabled = true;
        _renderStagePanel();
    });

    var list = _el('hl-reminder-list');
    (hlDraft.reminders || []).forEach(function(rem, i){
        var image = rem.imageId ? hlDraft.images.find(function(img){ return String(img.id) === String(rem.imageId); }) : null;
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:9px;border:1px solid rgba(76,209,55,0.32);border-radius:6px;padding:8px;background:#0d1a12;font-size:0.76em;';
        row.innerHTML = [
            '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:5px;">',
              '<span style="color:#8fe8ac;">'+_esc(rem.section||'Allgemein')+'</span>',
              '<button class="hl-rem-del" data-idx="'+i+'" style="background:none;border:none;color:#f66;cursor:pointer;font-size:0.9em;">&#x1F5D1;</button>',
            '</div>',
            image ? ('<img src="'+image.dataURL+'" style="max-width:100%;max-height:44px;object-fit:contain;border-radius:2px;margin-bottom:4px;display:block;">') : '',
            '<textarea class="hl-rem-text" data-idx="'+i+'" rows="2" style="width:100%;background:#0a0a12;border:1px solid rgba(76,209,55,0.35);color:#c9ffd8;border-radius:3px;padding:4px 5px;font-size:0.95em;box-sizing:border-box;resize:vertical;">'+_esc(rem.text||'')+'</textarea>',
            '<label style="display:flex;align-items:center;gap:7px;color:#a7f3c3;font-size:0.78em;margin-top:4px;"><input class="hl-rem-void" data-idx="'+i+'" type="checkbox" '+(rem.voidEnabled===false?'':'checked')+' style="accent-color:#4cd137;">In The Void</label>',
        ].join('');
        list.appendChild(row);
    });

    list.querySelectorAll('.hl-rem-del').forEach(function(btn){
        btn.addEventListener('click', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (!isNaN(idx)) {
                hlDraft.reminders.splice(idx, 1);
                _renderStagePanel();
            }
        });
    });
    list.querySelectorAll('.hl-rem-text').forEach(function(inp){
        inp.addEventListener('input', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.reminders[idx]) hlDraft.reminders[idx].text = e.target.value;
        });
    });
    list.querySelectorAll('.hl-rem-void').forEach(function(cb){
        cb.addEventListener('change', function(e){
            var idx = parseInt(e.target.dataset.idx);
            if (hlDraft.reminders[idx]) hlDraft.reminders[idx].voidEnabled = !!e.target.checked;
        });
    });
}

// ---------------------------------------------------------------------------
// Publish panel (Stage 7)
// ---------------------------------------------------------------------------
function _renderPanelPublish(panel) {
    var hubs=(_appState&&_appState.hubs)||[];
    var hubOpts=hubs.map(function(h,i){return '<option value="'+i+'"'+(i===_selectedHubIndex?' selected':'')+'>'+_esc(h.name)+' ('+((h.worlds||[]).length)+' Welten)</option>';}).join('');
    panel.innerHTML=[
        '<div style="padding:14px 14px 10px;flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;">',
          '<h3 style="margin:0 0 6px;color:#a29bfe;font-family:Cinzel,serif;font-size:0.95em;">Welt veroeffentlichen</h3>',
          '<div>',
            '<label style="font-size:0.78em;color:#888;display:block;margin-bottom:3px;">Weltname:</label>',
            '<input id="hl-pub-name" type="text" value="'+_esc(hlDraft.pdfName)+'" style="width:100%;padding:6px 8px;background:#111;border:1px solid rgba(162,155,254,0.4);color:#fff;border-radius:5px;font-size:0.88em;box-sizing:border-box;">',
          '</div>',
          '<div>',
            '<label style="font-size:0.78em;color:#888;display:block;margin-bottom:3px;">Buch (Hub):</label>',
            hubs.length?'<select id="hl-pub-hub" style="width:100%;padding:6px;background:#111;border:1px solid rgba(162,155,254,0.3);color:#bbb;border-radius:4px;font-size:0.82em;margin-bottom:5px;">'+hubOpts+'</select>':'<p style="font-size:0.8em;color:#555;margin:0 0 5px;">Keine Buecher vorhanden.</p>',
            '<div style="display:flex;gap:5px;">',
              '<input id="hl-pub-newhub" type="text" placeholder="Neues Buch erstellen..." style="flex:1;padding:5px 7px;background:#111;border:1px solid rgba(162,155,254,0.25);color:#ccc;border-radius:4px;font-size:0.78em;box-sizing:border-box;">',
              '<button id="btn-pub-addhub" style="padding:5px 10px;background:rgba(162,155,254,0.18);border:1px solid rgba(162,155,254,0.4);color:#a29bfe;border-radius:4px;cursor:pointer;font-size:0.78em;">+ Erstellen</button>',
            '</div>',
          '</div>',
          '<div style="border-top:1px solid #2a2a3a;padding-top:8px;font-size:0.76em;color:#888;line-height:1.9;">',
            '<span style="color:#a29bfe;">Zusammenfassung:</span><br>',
            hlDraft.chapters.length+' Kapitel &nbsp; '+hlDraft.images.length+' Bilder<br>',
                        hlDraft.flashcards.length+' Lernkarten &nbsp; '+hlDraft.quizzes.length+' Quiz-Fragen &nbsp; '+hlDraft.exams.length+' Pruefungsaufgaben<br>',
                        (hlDraft.tasks||[]).length+' Task(s) &nbsp; '+(hlDraft.mathItems||[]).length+' Math item(s) &nbsp; '+(hlDraft.reminders||[]).length+' Reminder(s)',
          '</div>',
          '<button id="btn-pub-go" style="padding:12px;background:linear-gradient(135deg,#5e4bb0,#a29bfe);border:none;color:#fff;border-radius:7px;cursor:pointer;font-size:0.95em;font-weight:bold;font-family:Cinzel,serif;letter-spacing:0.5px;margin-top:auto;">Welt erstellen &amp; speichern</button>',
        '</div>',
    ].join('');
    var hubSel=_el('hl-pub-hub');
    if(hubSel) hubSel.addEventListener('change',function(e){ _selectedHubIndex=parseInt(e.target.value); });
    var addHubBtn=_el('btn-pub-addhub');
    if(addHubBtn) addHubBtn.addEventListener('click',function(){
        var name=(_el('hl-pub-newhub').value||'').trim();
        if(!name) return;
        if(!_appState.hubs) _appState.hubs=[];
        _appState.hubs.push({name:name,worlds:[],currentWorldIndex:0});
        _selectedHubIndex=_appState.hubs.length-1;
        if(_saveStore) _saveStore();
        _renderStagePanel();
    });
    var goBtn=_el('btn-pub-go');
    if(goBtn) goBtn.addEventListener('click',function(){
        var worldName=(_el('hl-pub-name').value||'').trim()||hlDraft.pdfName||'Neue Welt';
        var hubSel2=_el('hl-pub-hub');
        var hubIdx=hubSel2?parseInt(hubSel2.value):_selectedHubIndex;
        if(!_appState||!_appState.hubs||!_appState.hubs[hubIdx]){ alert('Bitte ein Buch auswaehlen!'); return; }
        _publishWorld(worldName,hubIdx);
    });
}

// ---------------------------------------------------------------------------
// World builder + publish
// ---------------------------------------------------------------------------
function _publishWorld(worldName,hubIdx) {
    var hub=_appState.hubs[hubIdx];
    if(!hub) return;
    var world=_buildWorldFromDraft(worldName);
    // ensure unique name within hub
    var existing=new Set((hub.worlds||[]).map(function(w){return w.name;}));
    var finalName=worldName, n=2;
    while(existing.has(finalName)) finalName=worldName+' ('+n+++')';
    world.name=finalName;
    if(!hub.worlds) hub.worlds=[];
    hub.worlds.push(world);
    hub.currentWorldIndex=hub.worlds.length-1;
    _appState.currentHubIndex=hubIdx;
    if(_saveStore) _saveStore();
    document.getElementById('pdf-highlighter-modal').classList.add('hidden');
    if(_renderMap) _renderMap();
    if(_showToast) _showToast('Welt "'+finalName+'" wurde erstellt!');
}

function _buildWorldFromDraft(worldName) {
    var sections=hlDraft.chapters.map(function(c){return c.name;});
    var world={
        name:worldName,
        sections:sections.slice(),
        flashcards:[],quizzes:[],exams:[],
        tasks:[],miniGames:[],rituals:[],chronicles:[],
        content:{},progress:{},background:null,coordinates:[],
        imageLibrary:hlDraft.images.slice(),
        reminders:[],
        reminderScroller:{ cursor:0, dailyShown:{} },
    };
    sections.forEach(function(sec){
        world.content[sec]=(hlDraft.chapterTexts[sec]||[]).join('\n\n');
        world.progress[sec]={quizPassed:false,examPassed:false,gameCooldowns:{}};
    });
    hlDraft.flashcards.forEach(function(fc){
        world.flashcards.push({
            section:fc.section,
            question:fc.q.text||'',
            answer:fc.a.text||'',
            imageData:fc.q.imageData||null,
            questionImageData:fc.q.imageData||null,
            answerImageData:fc.a.imageData||null,
            voidEnabled: fc.voidEnabled !== false,
            interval:0,ease:2.5,nextReview:0,burned:false,
        });
    });
    hlDraft.quizzes.forEach(function(q){
        world.quizzes.push({
            section:q.section,
            question:q.q.text||'',
            answer:q.a.text||'',
            imageData:q.q.imageData||null,
            questionImageData:q.q.imageData||null,
            answerImageData:q.a.imageData||null,
            voidEnabled: q.voidEnabled !== false,
        });
    });
    hlDraft.exams.forEach(function(ex){
        world.exams.push({
            section:ex.section,
            question:ex.question||'',
            answer:ex.elaboration||ex.answer||'',
            imageData:ex.qImageData||null,
            questionImageData:ex.qImageData||null,
            answerImageData:ex.aImageData||null,
            voidEnabled: ex.voidEnabled !== false,
        });
    });
    world.tasks=(hlDraft.tasks||[]).map(function(t){
        return {
            section:t.section||sections[0]||'Allgemein',
            text:(t.text||'').trim(),
            completed:!!t.completed,
            voidEnabled: t.voidEnabled !== false,
        };
    }).filter(function(t){ return !!t.text; });
    var DEFAULT_GAMES=['Flash Match','Spellweaver','Cloze Trial'];
    sections.forEach(function(sec){
        DEFAULT_GAMES.forEach(function(name){ world.miniGames.push({section:sec,name:name}); });
    });
    (hlDraft.mathItems||[]).forEach(function(m){
        var sec = m.section || sections[0] || 'Allgemein';
        var rawQ = (m.q || '').trim();
        var latexQ = (m.latex || '').trim();
        var q = latexQ || rawQ;
        var a = (m.a || '').trim();
        var cat = m.category || 'flashcards';
        if (!q) return;

        if (cat === 'flashcards') {
            world.flashcards.push({ section:sec, question:q, rawQuestion:rawQ, mathLatex:latexQ||q, answer:a||'Review this equation.', interval:0,ease:2.5,nextReview:0,burned:false, isMath:true, voidEnabled: m.voidEnabled !== false });
            return;
        }
        if (cat === 'quizzes') {
            world.quizzes.push({ section:sec, question:q, rawQuestion:rawQ, mathLatex:latexQ||q, answer:a||'See notes/solution.', isMath:true, voidEnabled: m.voidEnabled !== false });
            return;
        }
        if (cat === 'exams') {
            world.exams.push({ section:sec, question:q, rawQuestion:rawQ, mathLatex:latexQ||q, answer:a||'Provide a full derivation.', isMath:true, voidEnabled: m.voidEnabled !== false });
            return;
        }
        if (cat === 'tasks') {
            world.tasks.push({ section:sec, text:'Solve: '+q+(a?(' -> '+a):''), rawQuestion:rawQ, mathLatex:latexQ||q, completed:false, isMath:true, voidEnabled: m.voidEnabled !== false });
            return;
        }
        if (cat === 'minigames') {
            world.flashcards.push({ section:sec, question:q, rawQuestion:rawQ, mathLatex:latexQ||q, answer:a||'Review this equation.', interval:0,ease:2.5,nextReview:0,burned:false, isMath:true, voidEnabled: m.voidEnabled !== false });
            if (!world.miniGames.some(function(g){ return g.section===sec && (String(g.name||'').toLowerCase()==='cloze trial'); })) {
                world.miniGames.push({ section:sec, name:'Cloze Trial' });
            }
            return;
        }
        if (!world.content[sec]) world.content[sec] = '';
        world.content[sec] += '\n\n[MATH] '+q+(rawQ && rawQ !== q ? ('\nSource Text: '+rawQ) : '')+(a?('\nSolution: '+a):'');
    });
    (hlDraft.reminders||[]).forEach(function(rem){
        var sec = rem.section || sections[0] || 'Allgemein';
        var txt = (rem.text || '').trim();
        if (!txt) return;
        var image = rem.imageId ? hlDraft.images.find(function(img){ return String(img.id) === String(rem.imageId); }) : null;
        world.reminders.push({
            id: rem.id || _uid(),
            section: sec,
            text: txt,
            imageData: image ? image.dataURL : null,
            shownCount: 0,
            burned: false,
            stability: 1,
            dueAt: 0,
            lastShownDay: '',
            burnCycles: 0,
            voidEnabled: rem.voidEnabled !== false
        });
    });
    if(_genCoords) world.coordinates=_genCoords(sections.length);
    return world;
}



