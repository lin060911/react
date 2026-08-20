/* balls.js — 定位反应测试 */
(function () {
    const gameContainer = document.getElementById('gameContainer');
    const flowTip = document.getElementById('flowTip');
    const timer = document.getElementById('timer');
    const progress = document.getElementById('progress');

    const currentAvgEl = document.getElementById('currentAvg');
    const bestAvgEl = document.getElementById('bestAvg');

    const MAX_SYMBOLS = 3;
    const TOTAL_ROUNDS = 15;
    const SYMBOL_SIZE = 60;
    const CONTAINER_PADDING = 80;
    const COOLDOWN_DURATION = 500;

    let gameActive = false;
    let isCooldown = false;
    let clickTimes = [];
    let currentRound = 0;
    let startTime = 0;
    let roundTimer = null;
    let reactionTimer = null;
    let gameEnded = false;

    let bestScores = {
        avg: localStorage.getItem('reactionBestAvg') || '--'
    };

    function getRandomPosition(existingPositions = []) {
        const containerWidth = gameContainer.offsetWidth;
        const containerHeight = gameContainer.offsetHeight;
        const minDistance = SYMBOL_SIZE * 5;
        let x, y;
        for (let i = 0; i < 100; i++) {
            x = CONTAINER_PADDING + Math.random() * (containerWidth - 2 * CONTAINER_PADDING);
            y = CONTAINER_PADDING + Math.random() * (containerHeight - 2 * CONTAINER_PADDING);
            let overlap = false;
            for (const pos of existingPositions) {
                const distance = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
                if (distance < minDistance) { overlap = true; break; }
            }
            if (!overlap) return { x, y };
        }
        return { x, y };
    }

    function createSymbol(type, x, y) {
        const symbol = document.createElement('div');
        symbol.className = 'symbol-circle';
        symbol.style.left = `${x}px`;
        symbol.style.top = `${y}px`;
        symbol.style.zIndex = type === 'correct' ? '10' : '2';
        symbol.dataset.type = type;
        symbol.textContent = type === 'correct' ? '◉' : '◯';

        symbol.addEventListener('click', handleSymbolClick);
        symbol.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleSymbolClick.call(symbol, e);
        }, { passive: false });

        return symbol;
    }

    function showSymbols() {
        if (gameEnded || !gameActive) return;
        gameContainer.innerHTML = '';
        const symbolCount = Math.floor(Math.random() * MAX_SYMBOLS) + 3;
        const correctIndex = Math.floor(Math.random() * symbolCount);
        progress.textContent = `第 ${currentRound}/${TOTAL_ROUNDS} 轮 | 符号数量: ${symbolCount}`;

        const positions = [];
        for (let i = 0; i < symbolCount; i++) {
            const position = getRandomPosition(positions);
            positions.push(position);
            const type = i === correctIndex ? 'correct' : 'wrong';
            const symbol = createSymbol(type, position.x, position.y);
            gameContainer.appendChild(symbol);
            setTimeout(() => symbol.classList.add('visible'), i * 10);
        }

        startTime = performance.now();
        timer.classList.add('visible');
        timer.textContent = '0 ms';
        clearInterval(reactionTimer);
        reactionTimer = setInterval(updateReactionTimer, 10);
    }

    function updateReactionTimer() {
        if (startTime === 0 || gameEnded || isCooldown) return;
        const elapsed = Math.round(performance.now() - startTime);
        timer.textContent = `${elapsed} ms`;
    }

    function handleSymbolClick(e) {
        e.preventDefault();
        if (!gameActive || isCooldown || gameEnded || startTime === 0) return;

        const symbol = this;
        const isCorrect = symbol.dataset.type === 'correct';
        clearInterval(reactionTimer);
        timer.classList.remove('visible');

        const allSymbols = document.querySelectorAll('.symbol-circle');
        allSymbols.forEach(s => {
            s.classList.add(s.dataset.type === 'correct' ? 'correct' : 'wrong');
        });

        if (isCorrect) {
            const clickTime = Math.round(performance.now() - startTime);
            clickTimes.push(clickTime);
            flowTip.textContent = `正确！用时: ${clickTime} ms`;
            flowTip.className = 'flow-tip text-green';
            updateCurrentStats();
            startCooldown();
            if (currentRound >= TOTAL_ROUNDS) { endGame(); return; }
            setTimeout(() => { currentRound++; showSymbols(); }, COOLDOWN_DURATION);
        } else {
            flowTip.textContent = '错误！请点击正确符号，本轮重新开始';
            flowTip.className = 'flow-tip text-red';
            startCooldown();
            setTimeout(() => showSymbols(), COOLDOWN_DURATION);
        }
    }

    function startCooldown() {
        isCooldown = true;
        startTime = 0;
        setTimeout(() => { isCooldown = false; }, COOLDOWN_DURATION);
    }

    function startGame() {
        gameActive = true;
        isCooldown = false;
        gameEnded = false;
        clickTimes = [];
        currentRound = 1;
        startTime = 0;
        clearInterval(reactionTimer);
        clearTimeout(roundTimer);
        flowTip.textContent = '测试开始！寻找并点击◉符号';
        flowTip.className = 'flow-tip text-yellow';
        timer.classList.remove('visible');
        updateCurrentStats();
        setTimeout(() => showSymbols(), 500);
    }

    function endGame() {
        gameEnded = true;
        gameActive = false;
        updateCurrentStats();
        checkAndUpdateBestScores();
        flowTip.textContent = `测试结束！完成全部${TOTAL_ROUNDS}轮测试`;
        flowTip.className = 'flow-tip text-yellow';
        gameContainer.innerHTML = '';
        progress.textContent = `测试完成 | 共${TOTAL_ROUNDS}轮`;
    }

    function fullReset() {
        gameActive = false;
        isCooldown = false;
        gameEnded = false;
        clickTimes = [];
        currentRound = 0;
        startTime = 0;
        clearInterval(reactionTimer);
        clearTimeout(roundTimer);
        gameContainer.innerHTML = '';
        timer.classList.remove('visible');
        timer.textContent = '';
        progress.textContent = '';
        flowTip.textContent = '点击屏幕或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        updateCurrentStats();
    }

    function updateCurrentStats() {
        const avg = clickTimes.length > 0
            ? Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length)
            : '--';
        currentAvgEl.textContent = avg === '--' ? '-- ms' : `${avg} ms`;
    }

    function updateBestStats() {
        bestAvgEl.textContent = bestScores.avg === '--' ? '-- ms' : `${bestScores.avg} ms`;
    }

    function checkAndUpdateBestScores() {
        if (clickTimes.length < TOTAL_ROUNDS) return;
        const currentAvg = Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length);
        if (bestScores.avg === '--' || currentAvg < bestScores.avg) {
            bestScores.avg = currentAvg;
            localStorage.setItem('reactionBestAvg', currentAvg);
        }
        updateBestStats();
    }

    function handleKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!gameActive || gameEnded) { fullReset(); startGame(); }
        }
    }

    function handleInteraction(e) {
        e.preventDefault();
        if (isCooldown) return;
        if (!gameActive || gameEnded) { fullReset(); startGame(); }
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    updateCurrentStats();
    updateBestStats();
})();
