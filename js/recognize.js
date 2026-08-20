/* recognize.js — 辨别反应测试 */
(function () {
    const gameContainer = document.getElementById('gameContainer');
    const flowTip = document.getElementById('flowTip');
    const timer = document.getElementById('timer');
    const progress = document.getElementById('progress');

    const currentAvgEl = document.getElementById('currentAvg');
    const currentAccuracyEl = document.getElementById('currentAccuracy');
    const bestAvgEl = document.getElementById('bestAvg');
    const bestAccuracyEl = document.getElementById('bestAccuracy');

    const MIN_SHAPES = 4;
    const MAX_SHAPES = 8;
    const TOTAL_ROUNDS = 15;
    const SHAPE_SIZE = 100;
    const CONTAINER_PADDING = 80;
    const COOLDOWN_DURATION = 500;

    const SHAPES = [
        { name: '圆形', className: 'shape-circle' },
        { name: '正方形', className: 'shape-square' },
        { name: '三角形', className: 'shape-triangle' },
        { name: '菱形', className: 'shape-diamond' },
        { name: '圆环', className: 'shape-ring' },
        { name: '五边形', className: 'shape-pentagon' },
        { name: '六边形', className: 'shape-hexagon' },
        { name: '四角星', className: 'shape-four-star' },
        { name: '五角星', className: 'shape-five-star' },
    ];

    const COLORS = [
        { name: '红色', value: '#fd4b4b' },
        { name: '橙色', value: '#ff8f49' },
        { name: '黄色', value: '#f4ff57' },
        { name: '绿色', value: '#3eff48' },
        { name: '蓝色', value: '#3f88fd' },
        { name: '白色', value: '#f0f0f0' },
    ];

    let gameActive = false;
    let isCooldown = false;
    let correctTimes = [];
    let currentRound = 0;
    let startTime = 0;
    let reactionTimer = null;
    let gameEnded = false;
    let correctCount = 0;

    let targetColor = null;
    let targetShape = null;

    let bestScores = {
        avg: localStorage.getItem('discriminationBestAvg') || '--',
        accuracy: localStorage.getItem('discriminationBestAccuracy') || '--'
    };

    function getRandomPosition(existingPositions = []) {
        const containerWidth = gameContainer.offsetWidth;
        const containerHeight = gameContainer.offsetHeight;
        const minDistance = SHAPE_SIZE * 1.5;
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

    function createShape(shapeObj, colorObj, isCorrect, x, y) {
        const shape = document.createElement('div');
        shape.className = `shape-item ${shapeObj.className}`;
        shape.style.left = `${x}px`;
        shape.style.top = `${y}px`;

        if (shapeObj.className === 'shape-triangle') {
            shape.style.borderBottomColor = colorObj.value;
        } else if (shapeObj.className === 'shape-ring') {
            shape.style.borderColor = colorObj.value;
        } else {
            shape.style.backgroundColor = colorObj.value;
        }

        shape.dataset.color = colorObj.name;
        shape.dataset.shape = shapeObj.name;
        shape.dataset.correct = isCorrect;

        const feedbackOverlay = document.createElement('div');
        feedbackOverlay.className = 'feedback-overlay';
        shape.appendChild(feedbackOverlay);

        shape.addEventListener('click', handleShapeClick);
        shape.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleShapeClick.call(shape, e);
        }, { passive: false });

        return shape;
    }

    function showShapes() {
        if (gameEnded || !gameActive) return;
        gameContainer.innerHTML = '';

        targetColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        targetShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
        const shapeCount = Math.floor(Math.random() * (MAX_SHAPES - MIN_SHAPES + 1)) + MIN_SHAPES;

        flowTip.textContent = `选择[ ${targetColor.name} ]的[ ${targetShape.name} ]!!!`;
        flowTip.className = 'flow-tip text-imp';
        progress.textContent = `第 ${currentRound}/${TOTAL_ROUNDS} 轮 | 图形数量: ${shapeCount}`;

        const positions = [];
        const correctPosition = getRandomPosition(positions);
        positions.push(correctPosition);
        const correctShape = createShape(targetShape, targetColor, true, correctPosition.x, correctPosition.y);
        gameContainer.appendChild(correctShape);

        for (let i = 1; i < shapeCount; i++) {
            let randomColor, randomShape;
            do {
                randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
                randomShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            } while (randomColor.name === targetColor.name && randomShape.name === targetShape.name);

            const position = getRandomPosition(positions);
            positions.push(position);
            const shape = createShape(randomShape, randomColor, false, position.x, position.y);
            gameContainer.appendChild(shape);
        }

        const shapes = document.querySelectorAll('.shape-item');
        shapes.forEach((shape, index) => {
            setTimeout(() => shape.classList.add('visible'), index * 10);
        });

        startTime = performance.now();
        timer.classList.add('visible');
        timer.textContent = '0 ms';
        clearInterval(reactionTimer);
        reactionTimer = setInterval(updateReactionTimer, 10);
    }

    function updateReactionTimer() {
        if (startTime === 0 || gameEnded || isCooldown) return;
        timer.textContent = `${Math.round(performance.now() - startTime)} ms`;
    }

    function handleShapeClick(e) {
        e.preventDefault();
        if (!gameActive || isCooldown || gameEnded || startTime === 0) return;

        const shape = this;
        const isCorrect = shape.dataset.correct === 'true';
        clearInterval(reactionTimer);
        timer.classList.remove('visible');

        const feedbackOverlay = shape.querySelector('.feedback-overlay');
        if (feedbackOverlay) {
            feedbackOverlay.classList.add(isCorrect ? 'correct' : 'wrong');
        }

        if (isCorrect) {
            const clickTime = Math.round(performance.now() - startTime);
            correctTimes.push(clickTime);
            correctCount++;
            flowTip.textContent = `正确！用时: ${clickTime} ms`;
            flowTip.className = 'flow-tip text-green';
        } else {
            flowTip.textContent = `错误！目标: ${targetColor.name}的${targetShape.name}`;
            flowTip.className = 'flow-tip text-red';
        }

        updateCurrentStats();
        startCooldown();

        if (currentRound >= TOTAL_ROUNDS) {
            setTimeout(endGame, COOLDOWN_DURATION);
            return;
        }
        setTimeout(() => { currentRound++; showShapes(); }, COOLDOWN_DURATION);
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
        correctTimes = [];
        correctCount = 0;
        currentRound = 1;
        startTime = 0;
        clearInterval(reactionTimer);
        flowTip.textContent = '测试开始！寻找并点击目标图形';
        flowTip.className = 'flow-tip text-yellow';
        timer.classList.remove('visible');
        updateCurrentStats();
        setTimeout(() => showShapes(), 500);
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
        correctTimes = [];
        correctCount = 0;
        currentRound = 0;
        startTime = 0;
        clearInterval(reactionTimer);
        gameContainer.innerHTML = '';
        timer.classList.remove('visible');
        timer.textContent = '';
        progress.textContent = '';
        flowTip.textContent = '点击屏幕或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        updateCurrentStats();
    }

    function updateCurrentStats() {
        const avg = correctTimes.length > 0
            ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length)
            : '--';
        const accuracy = currentRound > 0
            ? Math.round((correctCount / currentRound) * 100)
            : '--';
        currentAvgEl.textContent = avg === '--' ? '-- ms' : `${avg} ms`;
        currentAccuracyEl.textContent = accuracy === '--' ? '-- %' : `${accuracy} %`;
    }

    function updateBestStats() {
        bestAvgEl.textContent = bestScores.avg === '--' ? '-- ms' : `${bestScores.avg} ms`;
        bestAccuracyEl.textContent = bestScores.accuracy === '--' ? '-- %' : `${bestScores.accuracy} %`;
    }

    function checkAndUpdateBestScores() {
        if (currentRound < TOTAL_ROUNDS) return;
        const currentAvg = correctTimes.length > 0
            ? Math.round(correctTimes.reduce((a, b) => a + b, 0) / correctTimes.length)
            : '--';
        const currentAccuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);

        if (bestScores.avg === '--' || (currentAvg !== '--' && currentAvg < bestScores.avg)) {
            bestScores.avg = currentAvg;
            localStorage.setItem('discriminationBestAvg', currentAvg);
        }
        if (bestScores.accuracy === '--' || currentAccuracy > bestScores.accuracy) {
            bestScores.accuracy = currentAccuracy;
            localStorage.setItem('discriminationBestAccuracy', currentAccuracy);
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

    updateCurrentStats();
    updateBestStats();
})();
