/* =====================================================================
   TIC TAC TOE — FULL GAME LOGIC
   Supports: Local 2P | vs AI | Online (PeerJS WebRTC P2P)
   ===================================================================== */

// ─── CONSTANTS ────────────────────────────────────────────────────────
const WIN_PATTERNS = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
];
const CONFETTI_COLORS = ['#ff6b9d','#4ecdc4','#ffd166','#7b2fff','#a8edea','#ff9a9e','#a1c4fd'];

// ─── GAME STATE ───────────────────────────────────────────────────────
let mode        = 'pvp';          // 'pvp' | 'pvc' | 'online'
let boardState  = Array(9).fill('');
let turn        = 'O';            // 'O' always goes first
let gameActive  = false;
let myMark      = null;           // Online: 'O' (host) or 'X' (guest)
let p1          = 'Player 1';
let p2          = 'Player 2';
const scores    = { O: 0, X: 0, D: 0 };

// ─── PEERJS STATE ─────────────────────────────────────────────────────
let peer       = null;
let conn       = null;
let isHost     = false;
let myRoomCode = '';

// ─── DOM REFS ─────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const setupScreen  = $('setupScreen');
const lobbyScreen  = $('lobbyScreen');
const gameScreen   = $('gameScreen');
const cells        = document.querySelectorAll('.cell');
const turnText     = $('turnText');
const turnAvatar   = $('turnAvatar');
const sc1          = $('sc1');
const sc2          = $('sc2');
const sc1Name      = $('sc1Name');
const sc2Name      = $('sc2Name');
const sc1Score     = $('sc1Score');
const sc2Score     = $('sc2Score');
const scDraw       = $('scDraw');
const resultOverlay = $('resultOverlay');
const resultBig    = $('resultBig');
const resultTitle  = $('resultTitle');
const resultSub    = $('resultSub');
const confettiCanvas = $('confettiCanvas');
const onlineBadge  = $('onlineBadge');
const onlineBadgeText = $('onlineBadgeText');

// ─── SCREEN HELPERS ───────────────────────────────────────────────────
function showScreen(id) {
    [setupScreen, lobbyScreen, gameScreen].forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
}

// ─── TAB SWITCHING ────────────────────────────────────────────────────
function switchTab(t) {
    mode = t === 'ai' ? 'pvc' : t === 'online' ? 'online' : 'pvp';

    ['tabLocal','tabAI','tabOnline'].forEach(id => $( id ).classList.remove('active'));
    const tabMap = { local:'tabLocal', ai:'tabAI', online:'tabOnline' };
    $(tabMap[t]).classList.add('active');

    $('localInputs').classList.toggle('hidden', t === 'online');
    $('onlineInputs').classList.toggle('hidden', t !== 'online');
    $('p2NameGroup').classList.toggle('hidden', t === 'ai');
}

// ─── LOCAL GAME START ─────────────────────────────────────────────────
function startLocalGame() {
    p1 = $('p1Name').value.trim() || 'Player 1';
    p2 = mode === 'pvc' ? '🤖 AI' : ($('p2Name').value.trim() || 'Player 2');

    scores.O = 0; scores.X = 0; scores.D = 0;
    updateScoreDisplay();

    showScreen('gameScreen');
    onlineBadge.classList.add('hidden');
    initGame();
}

// ─── GAME INIT ────────────────────────────────────────────────────────
function initGame() {
    sc1Name.textContent = p1;
    sc2Name.textContent = p2;

    updateScoreDisplay();
    resetBoard();
}

function resetBoard() {
    boardState = Array(9).fill('');
    turn       = 'O';
    gameActive = true;

    cells.forEach(c => {
        c.textContent = '';
        c.className   = 'cell';
        c.disabled    = false;
    });

    resultOverlay.classList.add('hidden');
    stopConfetti();
    updateTurnUI();

    // Online: only my turn if I'm 'O'
    if (mode === 'online') lockBoardForOpponent();
    // AI first? (AI is always X, human is O, so human goes first)
}

// ─── CELL CLICK ───────────────────────────────────────────────────────
cells.forEach(cell => {
    const i = parseInt(cell.dataset.i);

    cell.addEventListener('click', () => {
        if (!gameActive || boardState[i] !== '') return;
        if (mode === 'online' && turn !== myMark) return;

        placeMove(i, turn);

        if (mode === 'online' && conn) {
            conn.send({ type: 'move', index: i });
        }
    });

    // Ghost hover preview
    cell.addEventListener('mouseenter', () => {
        if (!gameActive || boardState[i] !== '' || cell.disabled) return;
        if (mode === 'online' && turn !== myMark) return;
        cell.classList.add(turn === 'O' ? 'hover-o' : 'hover-x');
        cell.textContent = turn;
    });
    cell.addEventListener('mouseleave', () => {
        if (boardState[i] === '') {
            cell.classList.remove('hover-o', 'hover-x');
            cell.textContent = '';
        }
    });
});

// ─── PLACE A MOVE ─────────────────────────────────────────────────────
function placeMove(index, mark) {
    if (!gameActive || boardState[index] !== '') return;

    boardState[index] = mark;
    const cell = cells[index];
    cell.textContent = mark;
    cell.className   = `cell ${mark.toLowerCase()}`;
    cell.disabled    = true;

    playSound(mark === 'O' ? 220 : 330, 0.08, 'sine');

    const result = checkWinner();
    if (result === 'win') {
        gameActive = false;
        // highlight winning cells
        WIN_PATTERNS.forEach(pat => {
            const [a,b,c] = pat;
            if (boardState[a] === mark && boardState[b] === mark && boardState[c] === mark) {
                [a,b,c].forEach(i => cells[i].classList.add('win'));
            }
        });
        const winnerName = mark === 'O' ? p1 : p2;
        scores[mark]++;
        updateScoreDisplay();
        setTimeout(() => showResult(`${winnerName} Wins! 🏆`, '🎉', 'Congratulations!'), 350);
        launchConfetti();
        playWinSound();

    } else if (result === 'draw') {
        gameActive = false;
        scores.D++;
        updateScoreDisplay();
        setTimeout(() => showResult("It's a Draw!", '🤝', 'Well played both!'), 350);

    } else {
        turn = turn === 'O' ? 'X' : 'O';
        updateTurnUI();

        if (mode === 'online') lockBoardForOpponent();
        if (mode === 'pvc' && turn === 'X') setTimeout(aiMove, 450);
    }
}

// ─── WIN CHECK ────────────────────────────────────────────────────────
function checkWinner() {
    for (const [a,b,c] of WIN_PATTERNS) {
        if (boardState[a] && boardState[a] === boardState[b] && boardState[b] === boardState[c]) return 'win';
    }
    if (boardState.every(v => v !== '')) return 'draw';
    return null;
}

// ─── TURN UI ──────────────────────────────────────────────────────────
function updateTurnUI() {
    const name   = turn === 'O' ? p1 : p2;
    turnAvatar.textContent = turn === 'O' ? '⭕' : '❌';
    turnText.textContent   = `${name}'s turn`;
    sc1.classList.toggle('active', turn === 'O');
    sc2.classList.toggle('active', turn === 'X');
}

// ─── SCORE DISPLAY ────────────────────────────────────────────────────
function updateScoreDisplay() {
    sc1Score.textContent  = scores.O;
    sc2Score.textContent  = scores.X;
    scDraw.textContent    = scores.D;
}

// ─── RESULT OVERLAY ───────────────────────────────────────────────────
function showResult(title, emoji, sub) {
    resultBig.textContent   = emoji;
    resultTitle.textContent = title;
    resultSub.textContent   = sub;
    resultOverlay.classList.remove('hidden');
}

// ─── RESET / MENU ─────────────────────────────────────────────────────
function resetGame() {
    resetBoard();
    if (mode === 'online' && conn) conn.send({ type: 'reset' });
}

function goToMenu() {
    gameActive = false;
    stopConfetti();
    resultOverlay.classList.add('hidden');
    disconnectPeer();
    showScreen('setupScreen');
}

// ─── ONLINE: LOCK BOARD ───────────────────────────────────────────────
function lockBoardForOpponent() {
    const myTurn = turn === myMark;
    cells.forEach(c => {
        if (boardState[parseInt(c.dataset.i)] === '') c.disabled = !myTurn;
    });
}

// ─══════════════════════════════════════════════════════════════════════
//   AI (Greedy Minimax with full minimax for unbeatable)
// ═══════════════════════════════════════════════════════════════════════
function aiMove() {
    if (!gameActive || turn !== 'X') return;
    const best = minimax([...boardState], 'X', 0).index;
    if (best !== undefined && best !== -1) placeMove(best, 'X');
}

function minimax(board, mark, depth) {
    const opp = mark === 'X' ? 'O' : 'X';
    // Terminal checks
    for (const [a,b,c] of WIN_PATTERNS) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return { score: board[a] === 'X' ? (10 - depth) : (depth - 10) };
        }
    }
    const empty = board.reduce((acc,v,i) => v === '' ? [...acc,i] : acc, []);
    if (!empty.length) return { score: 0 };

    const plays = empty.map(i => {
        board[i] = mark;
        const result = minimax(board, opp, depth + 1);
        board[i] = '';
        return { index: i, score: result.score };
    });

    if (mark === 'X') return plays.reduce((a,b) => b.score > a.score ? b : a);
    else              return plays.reduce((a,b) => b.score < a.score ? b : a);
}

// ═══════════════════════════════════════════════════════════════════════
//   ONLINE MULTIPLAYER — PeerJS P2P
// ═══════════════════════════════════════════════════════════════════════

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── CREATE ROOM (Host) ────────────────────────────────────────────────
function createRoom() {
    const name = $('onlineName').value.trim() || 'Player 1';
    p1 = name;
    myMark = 'O';
    isHost = true;
    myRoomCode = generateCode();

    // Show lobby screen
    showScreen('lobbyScreen');
    $('roomCodeText').textContent = myRoomCode;
    $('lobbyTitle').textContent   = 'Waiting for friend…';
    $('lobbySubtitle').textContent = 'Share this room code';
    $('lobbyHint').textContent     = 'Ask your friend to enter this code';
    $('lobbyLoader').style.display = 'block';
    $('lobbyIcon').textContent     = '⏳';

    // Init PeerJS with room code as ID
    disconnectPeer();
    peer = new Peer(myRoomCode, { debug: 0 });

    peer.on('open', id => {
        console.log('Room created:', id);
    });

    peer.on('connection', connection => {
        conn = connection;
        setupConn();
    });

    peer.on('error', err => {
        console.error('Peer error:', err);
        showLobbyError('Connection failed. Try again.');
    });
}

// ── JOIN ROOM (Guest) ─────────────────────────────────────────────────
function joinRoom() {
    const name = $('onlineName').value.trim() || 'Player 2';
    const code = $('roomCodeInput').value.trim().toUpperCase();

    if (!code || code.length !== 6) {
        $('roomCodeInput').style.borderColor = '#e94560';
        $('roomCodeInput').placeholder = 'Enter 6-char code!';
        setTimeout(() => {
            $('roomCodeInput').style.borderColor = '';
            $('roomCodeInput').placeholder = 'Room code';
        }, 1500);
        return;
    }

    p2 = name;
    myMark = 'X';
    isHost = false;

    // Show lobby screen while connecting
    showScreen('lobbyScreen');
    $('roomCodeText').textContent   = code;
    $('lobbyTitle').textContent     = 'Connecting…';
    $('lobbySubtitle').textContent  = 'Joining room';
    $('lobbyHint').textContent      = 'Please wait…';
    $('lobbyLoader').style.display  = 'block';
    $('lobbyIcon').textContent      = '🔗';

    disconnectPeer();
    peer = new Peer(null, { debug: 0 });

    peer.on('open', () => {
        conn = peer.connect(code, { reliable: true });
        setupConn();
    });

    peer.on('error', err => {
        console.error('Peer error:', err);
        showLobbyError('Could not find room. Check the code and try again.');
    });
}

// ── CONNECTION SETUP ──────────────────────────────────────────────────
function setupConn() {
    conn.on('open', () => {
        if (isHost) {
            // Host sends their name and signals ready
            conn.send({ type: 'hello', name: p1 });
            $('lobbyIcon').textContent   = '✅';
            $('lobbyTitle').textContent  = 'Friend connected!';
            $('lobbyHint').textContent   = 'Starting game…';
            $('lobbyLoader').style.display = 'none';
            setTimeout(() => launchOnlineGame(), 900);
        } else {
            // Guest announces themselves
            conn.send({ type: 'hello', name: p2 });
        }
    });

    conn.on('data', data => {
        handlePeerMessage(data);
    });

    conn.on('close', () => {
        if (gameActive) showConnectionLost();
    });

    conn.on('error', err => {
        console.error('Connection error:', err);
        showLobbyError('Connection error. Please try again.');
    });
}

// ── HANDLE INCOMING MESSAGES ─────────────────────────────────────────
function handlePeerMessage(data) {
    switch (data.type) {
        case 'hello':
            if (isHost) {
                p2 = data.name;       // Guest told host their name
            } else {
                p1 = data.name;       // Host told guest their name
                $('lobbyIcon').textContent  = '✅';
                $('lobbyTitle').textContent = 'Connected!';
                $('lobbyHint').textContent  = 'Starting game…';
                $('lobbyLoader').style.display = 'none';
                setTimeout(() => launchOnlineGame(), 900);
            }
            break;

        case 'move':
            placeMove(data.index, turn);   // turn is already set to opponent's mark
            break;

        case 'reset':
            resetBoard();
            break;

        case 'rematch':
            scores.O = 0; scores.X = 0; scores.D = 0;
            updateScoreDisplay();
            resetBoard();
            break;
    }
}

// ── LAUNCH ONLINE GAME ────────────────────────────────────────────────
function launchOnlineGame() {
    mode = 'online';
    scores.O = 0; scores.X = 0; scores.D = 0;

    showScreen('gameScreen');
    onlineBadge.classList.remove('hidden');
    onlineBadgeText.textContent = `🌐 Online vs ${isHost ? p2 : p1}`;

    initGame();
}

// ── DISCONNECT ────────────────────────────────────────────────────────
function disconnectPeer() {
    if (conn)  { try { conn.close();  } catch(_) {} conn  = null; }
    if (peer)  { try { peer.destroy(); } catch(_) {} peer  = null; }
}

function cancelLobby() {
    disconnectPeer();
    showScreen('setupScreen');
}

// ── LOBBY ERROR ───────────────────────────────────────────────────────
function showLobbyError(msg) {
    $('lobbyIcon').textContent    = '❌';
    $('lobbyTitle').textContent   = 'Oops!';
    $('lobbyHint').textContent    = msg;
    $('lobbyLoader').style.display = 'none';
    $('roomCodeText').textContent  = '––––';
}

function showConnectionLost() {
    gameActive = false;
    showResult('Connection Lost 📡', '😢', 'Your friend disconnected');
}

// ── COPY ROOM CODE ────────────────────────────────────────────────────
function copyCode() {
    const code = $('roomCodeText').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
    });
}

// ═══════════════════════════════════════════════════════════════════════
//   CONFETTI
// ═══════════════════════════════════════════════════════════════════════
let confettiPieces = [];
let confettiAnim   = null;

function launchConfetti() {
    confettiCanvas.width  = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    confettiPieces = Array.from({length: 140}, () => ({
        x:        Math.random() * confettiCanvas.width,
        y:        -20 - Math.random() * 120,
        w:        Math.random() * 10 + 5,
        h:        Math.random() * 7 + 4,
        color:    CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vy:       Math.random() * 3.5 + 1.5,
        vx:       (Math.random() - 0.5) * 2.5,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 7,
        opacity:  1
    }));

    cancelAnimationFrame(confettiAnim);
    animateConfetti();
}

function animateConfetti() {
    const ctx = confettiCanvas.getContext('2d');
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    let alive = false;
    confettiPieces.forEach(p => {
        p.y  += p.vy;
        p.x  += p.vx;
        p.rotation += p.rotSpeed;
        if (p.y > confettiCanvas.height * 0.65) p.opacity -= 0.018;

        if (p.opacity > 0 && p.y < confettiCanvas.height + 20) {
            alive = true;
            ctx.save();
            ctx.globalAlpha = Math.max(0, p.opacity);
            ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
    });

    if (alive) confettiAnim = requestAnimationFrame(animateConfetti);
    else       stopConfetti();
}

function stopConfetti() {
    cancelAnimationFrame(confettiAnim);
    const ctx = confettiCanvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiPieces = [];
}

// ═══════════════════════════════════════════════════════════════════════
//   WEB AUDIO SOUNDS
// ═══════════════════════════════════════════════════════════════════════
let audioCtx = null;

function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

function playSound(freq, gain = 0.1, type = 'sine', duration = 0.12) {
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        vol.gain.setValueAtTime(gain, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch(_) {}
}

function playWinSound() {
    [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => playSound(f, 0.1, 'triangle', 0.2), i * 100);
    });
}

// ═══════════════════════════════════════════════════════════════════════
//   INIT
// ═══════════════════════════════════════════════════════════════════════
switchTab('local');
