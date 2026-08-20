/* HSline.js — 头线定位测试 */
(function () {
    const targetBall = document.getElementById('targetBall');
    const targetContainer = document.getElementById('targetContainer');
    const flowTip = document.getElementById('flowTip');
    const timer = document.getElementById('timer');

    const currentFastestEl = document.getElementById('currentFastest');
    const currentAvgEl = document.getElementById('currentAvg');
    const currentCorrectEl = document.getElementById('currentCorrect');
    const bestFastestEl = document.getElementById('bestFastest');
    const bestAvgEl = document.getElementById('bestAvg');
    const bestCorrectEl = document.getElementById('bestCorrect');

    const MIN_DELAY = 100;
    const MAX_DELAY = 500;
    const TIMEOUT_DURATION = 1000;
    const BALL_SIZE = 30;
    const CONTAINER_PADDING = 50;

    let testActive = false;
    let isCooldown = false;
    let clickTimes = [];
    let startTime = 0;
    let ballTimer = null;
    let reactionTimer = null;
    let testEnded = false;
    let timeoutTimer = null;

    let bestScores = {
        fastest: localStorage.getItem('mouseBestFastest') || '--',
        avg: localStorage.getItem('mouseBestAvg') || '--',
        correct: localStorage.getItem('mouseBestCorrect') || 0
    };

    function getRandomXPosition() {
        const containerWidth = targetContainer.offsetWidth;
        return CONTAINER_PADDING + Math.random() * (containerWidth - 2 * CONTAINER_PADDING);
    }

    function fullReset() {
        testActive = false;
        isCooldown = false;
        testEnded = false;
        clickTimes = [];
        startTime = 0;
        clearTimeout(ballTimer);
        clearInterval(reactionTimer);
        clearTimeout(timeoutTimer);
        targetBall.className = 'target-ball';
        timer.classList.remove('visible');
        timer.textContent = '';
        flowTip.textContent = '点击屏幕或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        updateCurrentStats();
    }

    function updateCurrentStats() {
        const fastest = clickTimes.length > 0 ? Math.min(...clickTimes) : '--';
        const avg = clickTimes.length > 0 ? Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length) : '--';
        const correct = clickTimes.length;
        currentFastestEl.textContent = fastest === '--' ? '-- ms' : `${fastest} ms`;
        currentAvgEl.textContent = avg === '--' ? '-- ms' : `${avg} ms`;
        currentCorrectEl.textContent = correct;
    }

    function updateBestStats() {
        bestFastestEl.textContent = bestScores.fastest === '--' ? '-- ms' : `${bestScores.fastest} ms`;
        bestAvgEl.textContent = bestScores.avg === '--' ? '-- ms' : `${bestScores.avg} ms`;
        bestCorrectEl.textContent = bestScores.correct;
    }

    function checkAndUpdateBestScores() {
        if (clickTimes.length === 0) return;
        const currentFastest = Math.min(...clickTimes);
        const currentAvg = Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length);
        const currentCorrect = clickTimes.length;

        if (bestScores.fastest === '--' || currentFastest < bestScores.fastest) {
            bestScores.fastest = currentFastest;
            localStorage.setItem('mouseBestFastest', currentFastest);
        }
        if (bestScores.avg === '--' || currentAvg < bestScores.avg) {
            bestScores.avg = currentAvg;
            localStorage.setItem('mouseBestAvg', currentAvg);
        }
        if (currentCorrect > bestScores.correct) {
            bestScores.correct = currentCorrect;
            localStorage.setItem('mouseBestCorrect', currentCorrect);
        }
        updateBestStats();
    }

    function handleTimeout() {
        if (testEnded || !testActive) return;
        clearInterval(reactionTimer);
        clearTimeout(timeoutTimer);
        timer.classList.remove('visible');
        testEnded = true;
        flowTip.textContent = `超时！1000ms内未点击，测试结束 | 正确次数: ${clickTimes.length}`;
        flowTip.className = 'flow-tip text-red';
        updateCurrentStats();
        targetBall.className = 'target-ball';
        startTime = 0;
        startCooldown();
    }

    function showTargetBall() {
        if (testEnded) return;
        const randomX = getRandomXPosition();
        targetBall.style.left = `${randomX}px`;
        targetBall.className = 'target-ball visible';
        startTime = performance.now();
        flowTip.textContent = '快速点击目标小球！';
        flowTip.className = 'flow-tip text-yellow';
        timer.classList.add('visible');
        timer.textContent = '0 ms';
        clearInterval(reactionTimer);
        reactionTimer = setInterval(updateReactionTimer, 10);
        clearTimeout(timeoutTimer);
        timeoutTimer = setTimeout(handleTimeout, TIMEOUT_DURATION);
    }

    function updateReactionTimer() {
        if (startTime === 0 || testEnded) return;
        timer.textContent = `${Math.round(performance.now() - startTime)} ms`;
    }

    function startCooldown() {
        isCooldown = true;
        setTimeout(() => {
            isCooldown = false;
            if (!testEnded) {
                ballTimer = setTimeout(showTargetBall, Math.random() * (MAX_DELAY - MIN_DELAY) + MIN_DELAY);
            } else {
                checkAndUpdateBestScores();
                flowTip.textContent = `${flowTip.textContent} | 按空格键或点击屏幕重新开始`;
                targetBall.className = 'target-ball';
            }
        }, 300);
    }

    function startTest() {
        fullReset();
        testActive = true;
        flowTip.textContent = '准备开始...';
        flowTip.className = 'flow-tip text-yellow';
        ballTimer = setTimeout(showTargetBall, 500);
    }

    function handleBallClick(e) {
        e.preventDefault();
        if (!testActive || isCooldown || startTime === 0 || testEnded) return;
        clearTimeout(timeoutTimer);
        clearInterval(reactionTimer);
        timer.classList.remove('visible');
        const clickTime = Math.round(performance.now() - startTime);
        clickTimes.push(clickTime);
        flowTip.textContent = `点击耗时: ${clickTime} ms`;
        flowTip.className = 'flow-tip text-green';
        updateCurrentStats();
        targetBall.className = 'target-ball';
        startTime = 0;
        startCooldown();
    }

    function handleKeydown(e) {
        if (e.code === 'Space') {
            e.preventDefault();
            if (!testActive || testEnded) startTest();
        }
    }

    function handleInteraction(e) {
        e.preventDefault();
        if (isCooldown) return;
        if (!testActive || testEnded) startTest();
    }

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction, { passive: false });
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    targetBall.addEventListener('click', handleBallClick);
    targetBall.addEventListener('touchstart', (e) => { e.preventDefault(); handleBallClick(e); }, { passive: false });

    updateCurrentStats();
    updateBestStats();
})();
