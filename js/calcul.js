/* calcul.js — 运算反应测试 */
(function () {
    const gameContainer = document.getElementById('gameContainer');
    const flowTip = document.getElementById('flowTip');
    const progress = document.getElementById('progress');
    const equation = document.getElementById('equation');
    const reactionCircle = document.getElementById('reactionCircle');
    const reactionIndicator = document.getElementById('reactionIndicator');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const calcTimer = document.getElementById('calcTimer');
    const reactTimer = document.getElementById('reactTimer');
    const inputFeedback = document.getElementById('inputFeedback');

    const currentCalcScoreEl = document.getElementById('currentCalcScore');
    const currentReactAvgEl = document.getElementById('currentReactAvg');
    const bestCalcScoreEl = document.getElementById('bestCalcScore');
    const bestReactAvgEl = document.getElementById('bestReactAvg');

    const OPERATORS = ['+', '×'];
    const TOTAL_REACTIONS = 5;
    const MIN_REACT_DELAY = 2000;
    const MAX_REACT_DELAY = 5000;
    const MIN_CALC_QUESTIONS = 5;

    let gameActive = false;
    let isReactPhase = false;
    let reactCount = 0;
    let currentReactionDelay = 0;

    let calcStartTime = 0;
    let reactStartTime = 0;
    let calcTimes = [];
    let reactTimes = [];
    let calcCorrect = 0;
    let calcTotal = 0;

    let currentEquation = '';
    let correctDigit = 0;
    let inputBuffer = '';

    let calcTimerInterval = null;
    let reactTimerInterval = null;
    let reactTimeout = null;
    let nextReactTimeout = null;

    let bestScores = {
        calcSpeed: localStorage.getItem('dualCalcSpeed') || '--',
        calcAcc: localStorage.getItem('dualCalcAcc') || '--',
        calcScore: localStorage.getItem('dualCalcScore') || 0,
        reactAvg: localStorage.getItem('dualReactAvg') || '--',
    };

    function generateEquation() {
        const operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
        let a, b, result;
        do {
            if (operator === '+') {
                a = Math.floor(Math.random() * 89) + 10;
                b = Math.floor(Math.random() * 89) + 10;
                result = a + b;
            } else {
                a = Math.floor(Math.random() * 9) + 1;
                b = Math.floor(Math.random() * 9) + 1;
                result = a * b;
            }
        } while (result < 0 || result >= 100 || !Number.isInteger(result));

        const resultStr = result.toString();
        const missingIndex = resultStr.length - 1;
        correctDigit = parseInt(resultStr[missingIndex]);
        const displayResult = resultStr.substring(0, missingIndex) + '□';
        return `${a} ${operator} ${b} = ${displayResult}`;
    }

    function calculateCalcScore() {
        if (calcTimes.length < MIN_CALC_QUESTIONS) return 0;
        const totalTime = calcTimes.reduce((a, b) => a + b, 0);
        const avgTime = totalTime / calcTimes.length;
        if (avgTime === 0) return 0;
        const accuracy = calcCorrect / calcTotal;
        return Math.round(accuracy * calcTimes.length * 1000000 / avgTime);
    }

    function getCalcStats() {
        if (calcTimes.length === 0) return { avgTime: '--', accuracy: '--' };
        const totalTime = calcTimes.reduce((a, b) => a + b, 0);
        const avgTime = Math.round(totalTime / calcTimes.length);
        const accuracy = Math.round((calcCorrect / calcTotal) * 100);
        return { avgTime, accuracy };
    }

    function startCalcTimer() {
        calcStartTime = performance.now();
        calcTimer.classList.add('visible');
        clearInterval(calcTimerInterval);
        calcTimerInterval = setInterval(() => {
            calcTimer.textContent = `计算: ${Math.round(performance.now() - calcStartTime)} ms`;
        }, 10);
    }

    function stopCalcTimer() {
        clearInterval(calcTimerInterval);
        calcTimer.classList.remove('visible');
        return Math.round(performance.now() - calcStartTime);
    }

    function startReactTimer() {
        reactStartTime = performance.now();
        reactTimer.classList.add('visible');
        reactTimerInterval = setInterval(() => {
            reactTimer.textContent = `反应: ${Math.round(performance.now() - reactStartTime)} ms`;
        }, 10);
    }

    function stopReactTimer() {
        clearInterval(reactTimerInterval);
        reactTimer.classList.remove('visible');
        return Math.round(performance.now() - reactStartTime);
    }

    function showEquation() {
        if (!gameActive) return;
        currentEquation = generateEquation();
        equation.textContent = currentEquation;
        inputBuffer = '';
        calcTotal++;
        startCalcTimer();
        flowTip.textContent = '输入结果的个位数字';
        flowTip.className = 'flow-tip text-blue';
        updateProgress();
    }

    function updateProgress() {
        progress.textContent = `计算: ${calcTotal} 题 | 反应: ${reactCount}/${TOTAL_REACTIONS} 次`;
    }

    function handleDigitInput(digit) {
        if (!gameActive || !calcStartTime) return;
        const calcTime = stopCalcTimer();
        calcStartTime = 0;
        calcTimes.push(calcTime);

        if (parseInt(digit) === correctDigit) {
            calcCorrect++;
            showFeedback('✓ 正确', 'text-green');
        } else {
            showFeedback('✗ 错误', 'text-red');
        }

        updateCalcScore();
        setTimeout(() => showEquation(), 300);
    }

    function showFeedback(text, colorClass) {
        inputFeedback.textContent = text;
        inputFeedback.className = `input-feedback ${colorClass}`;
        inputFeedback.classList.add('visible');
        setTimeout(() => inputFeedback.classList.remove('visible'), 800);
    }

    function startReactPhase() {
        if (!gameActive || isReactPhase || reactCount >= TOTAL_REACTIONS) return;
        isReactPhase = true;
        reactionCircle.classList.add('go');
        reactionIndicator.textContent = '立即点击！';
        startReactTimer();
    }

    function handleReaction() {
        if (!gameActive || !isReactPhase) return;
        const reactTime = stopReactTimer();
        reactTimes.push(reactTime);
        reactCount++;
        isReactPhase = false;
        reactionCircle.classList.remove('go');
        reactionIndicator.textContent = '继续计算...';
        flowTip.textContent = `第${reactCount}次反应: ${reactTime} ms`;
        flowTip.className = 'flow-tip text-green';
        updateProgress();
        updateReactStats();

        if (reactCount >= TOTAL_REACTIONS) { endGame(); return; }
        scheduleNextReact();
    }

    function scheduleNextReact() {
        if (reactCount >= TOTAL_REACTIONS || !gameActive) return;
        const delay = Math.random() * (MAX_REACT_DELAY - MIN_REACT_DELAY) + MIN_REACT_DELAY;
        currentReactionDelay = delay;
        reactionIndicator.textContent = `准备中...`;
        flowTip.textContent = ``;
        flowTip.className = 'flow-tip text-blue';
        nextReactTimeout = setTimeout(() => {
            if (gameActive) startReactPhase();
        }, delay);
    }

    function startGame() {
        gameActive = true;
        isReactPhase = false;
        reactCount = 0;
        calcTimes = [];
        reactTimes = [];
        calcCorrect = 0;
        calcTotal = 0;
        clearTimeout(reactTimeout);
        clearTimeout(nextReactTimeout);
        clearInterval(calcTimerInterval);
        clearInterval(reactTimerInterval);
        calcTimer.classList.remove('visible');
        reactTimer.classList.remove('visible');
        reactionCircle.classList.remove('go');
        equation.textContent = '准备开始...';
        reactionIndicator.textContent = '注意圆形变绿！';
        scoreDisplay.textContent = '当前计算分数: 0';
        flowTip.textContent = '测试开始！计算等式并注意圆形变色';
        flowTip.className = 'flow-tip text-blue';
        updateCurrentStats();
        updateProgress();
        setTimeout(() => { showEquation(); scheduleNextReact(); }, 1000);
    }

    function endGame() {
        gameActive = false;
        isReactPhase = false;
        clearInterval(calcTimerInterval);
        calcTimer.classList.remove('visible');
        calcTimer.textContent = '计算: -- ms';
        clearInterval(reactTimerInterval);
        reactTimer.classList.remove('visible');
        reactTimer.textContent = '反应: -- ms';
        updateCurrentStats();
        checkAndUpdateBestScores();
        flowTip.textContent = `测试完成！最终分数: ${calculateCalcScore()}`;
        flowTip.className = 'flow-tip text-yellow';
        reactionCircle.classList.remove('go');
        equation.textContent = '测试完成';
        reactionIndicator.textContent = '点击重新开始';
        clearTimeout(nextReactTimeout);
    }

    function updateCalcScore() {
        scoreDisplay.textContent = `当前计算分数: ${calculateCalcScore()}`;
        updateCurrentStats();
    }

    function updateCurrentStats() {
        const { avgTime, accuracy } = getCalcStats();
        const reactAvg = reactTimes.length > 0
            ? Math.round(reactTimes.reduce((a, b) => a + b, 0) / reactTimes.length)
            : '--';
        currentCalcScoreEl.textContent = `${avgTime === '--' ? '--' : avgTime + 'ms'} / ${accuracy === '--' ? '--' : accuracy}% / ${calcTotal}`;
        currentReactAvgEl.textContent = reactAvg === '--' ? '-- ms' : `${reactAvg} ms`;
    }

    function updateReactStats() {
        if (reactTimes.length > 0) {
            const avg = Math.round(reactTimes.reduce((a, b) => a + b, 0) / reactTimes.length);
            currentReactAvgEl.textContent = `${avg} ms`;
        }
    }

    function updateBestStats() {
        const calcCount = localStorage.getItem('dualCalcCount') || '--';
        bestCalcScoreEl.textContent = `${bestScores.calcSpeed === '--' ? '--' : bestScores.calcSpeed + 'ms'} / ${bestScores.calcAcc === '--' ? '--' : bestScores.calcAcc}% / ${calcCount}`;
        bestReactAvgEl.textContent = bestScores.reactAvg === '--' ? '-- ms' : `${bestScores.reactAvg} ms`;
    }

    function checkAndUpdateBestScores() {
        if (calcTimes.length === 0 || reactTimes.length === 0) return;
        const { avgTime, accuracy } = getCalcStats();
        const reactAvg = Math.round(reactTimes.reduce((a, b) => a + b, 0) / reactTimes.length);
        const calcScore = calculateCalcScore();

        if (calcScore > bestScores.calcScore) {
            bestScores.calcScore = calcScore;
            bestScores.calcSpeed = avgTime;
            bestScores.calcAcc = accuracy;
            localStorage.setItem('dualCalcScore', calcScore);
            localStorage.setItem('dualCalcSpeed', avgTime);
            localStorage.setItem('dualCalcAcc', accuracy);
            localStorage.setItem('dualCalcCount', calcTotal);
        }
        if (bestScores.reactAvg === '--' || reactAvg < bestScores.reactAvg) {
            bestScores.reactAvg = reactAvg;
            localStorage.setItem('dualReactAvg', reactAvg);
        }
        updateBestStats();
    }

    function handleKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!gameActive) { startGame(); return; }
            if (isReactPhase) handleReaction();
        }
        if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
            e.preventDefault();
            const digit = e.code.replace('Digit', '').replace('Numpad', '');
            if (digit >= '0' && digit <= '9') handleDigitInput(digit);
        }
    }

    function handleCircleClick(e) {
        e.stopPropagation();
        if (!gameActive) { startGame(); return; }
        if (isReactPhase) handleReaction();
    }

    function handleInteraction(e) {
        e.preventDefault();
        if (!gameActive) startGame();
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: false });

    reactionCircle.addEventListener('click', handleCircleClick);
    reactionCircle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleCircleClick(e);
    }, { passive: false });

    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('click', (e) => {
            e.stopPropagation();
            const keyVal = key.dataset.key;
            if (keyVal >= '0' && keyVal <= '9') handleDigitInput(keyVal);
        });
    });

    updateBestStats();
})();
