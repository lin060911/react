/* nogo.js — Go/No-Go 抑制反应测试 */
(function () {
    const circle = document.getElementById('circle');
    const flowTip = document.getElementById('flowTip');
    const progress = document.getElementById('progress');

    const TOTAL_TRIALS = 10;
    const GO_PROBABILITY = 0.7;
    const MIN_STIMULUS_DURATION = 800;
    const MAX_STIMULUS_DURATION = 1000;
    const MIN_INTERVAL_DURATION = 800;
    const MAX_INTERVAL_DURATION = 1600;

    let state = 'idle';
    let trial = 0;
    let isTestLocked = false;
    let stimulusHandled = false;

    let goCount = 0, goCorrect = 0;
    let noGoCount = 0, noGoCorrect = 0;
    let goTimes = [];

    let stimulusStartTime = 0;
    let timer = null;

    let bestGoRate = 0;
    let bestNoGoRate = 0;
    let bestAvgRT = Infinity;

    function loadBestFromStorage() {
        try {
            const defaultBest = { goRate: 0, noGoRate: 0, avgRT: Infinity };
            const stored = JSON.parse(localStorage.getItem('gngBestScores')) || defaultBest;
            bestGoRate = stored.goRate || 0;
            bestNoGoRate = stored.noGoRate || 0;
            bestAvgRT = stored.avgRT || Infinity;
        } catch (e) {
            bestGoRate = 0; bestNoGoRate = 0; bestAvgRT = Infinity;
        }
    }

    function saveBestToStorage() {
        try {
            localStorage.setItem('gngBestScores', JSON.stringify({
                goRate: bestGoRate, noGoRate: bestNoGoRate, avgRT: bestAvgRT
            }));
        } catch (e) {}
    }

    function updateBestDisplay() {
        document.getElementById('bestNoGoRate').textContent = bestNoGoRate === 0 ? '-- %' : bestNoGoRate + '%';
        document.getElementById('bestAvgRT').textContent = (bestAvgRT === Infinity || bestAvgRT === 0) ? '-- ms' : bestAvgRT + ' ms';
    }

    function resetUI() {
        circle.className = 'stimulus-circle circle-wait';
        circle.textContent = '开始';
        flowTip.textContent = '点击圆形或按空格键开始测试';
        flowTip.className = 'flow-tip text-gray';
        progress.textContent = '';
    }

    function resetState() {
        state = 'idle';
        trial = 0;
        isTestLocked = false;
        stimulusHandled = false;
        goCount = 0; goCorrect = 0;
        noGoCount = 0; noGoCorrect = 0;
        goTimes = [];
        if (timer) clearTimeout(timer);
        timer = null;
    }

    function getRandomDuration(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function showInterval() {
        if (trial >= TOTAL_TRIALS) { endTest(); return; }
        state = 'interval';
        stimulusHandled = false;
        circle.className = 'stimulus-circle circle-interval';
        circle.textContent = `第 ${trial + 1}/${TOTAL_TRIALS} 次`;
        flowTip.textContent = '准备';
        flowTip.className = 'flow-tip text-gray';

        timer = setTimeout(startTrial, getRandomDuration(MIN_INTERVAL_DURATION, MAX_INTERVAL_DURATION));
    }

    function startTrial() {
        trial++;
        progress.textContent = `第 ${trial}/${TOTAL_TRIALS} 次`;
        const isGo = Math.random() < GO_PROBABILITY;
        stimulusHandled = false;

        if (isGo) {
            goCount++;
            circle.className = 'stimulus-circle circle-go';
            circle.textContent = 'GO！';
            flowTip.textContent = '绿色：立即点击';
            flowTip.className = 'flow-tip text-green';
        } else {
            noGoCount++;
            circle.className = 'stimulus-circle circle-nogo';
            circle.textContent = 'NO-GO!';
            flowTip.textContent = '红色：不要点击';
            flowTip.className = 'flow-tip text-red';
        }

        stimulusStartTime = performance.now();
        state = 'stimulus';

        timer = setTimeout(() => {
            if (state !== 'stimulus') return;
            if (!isGo && !stimulusHandled) noGoCorrect++;
            stimulusHandled = true;
            showInterval();
        }, getRandomDuration(MIN_STIMULUS_DURATION, MAX_STIMULUS_DURATION));
    }

    function handleAction(e) {
        e.preventDefault();
        if (isTestLocked) return;

        if (state === 'idle') {
            resetState();
            resetUI();
            showInterval();
            return;
        }

        if (state === 'interval' || stimulusHandled) return;
        stimulusHandled = true;
        clearTimeout(timer);

        if (circle.classList.contains('circle-go')) {
            const rt = Math.round(performance.now() - stimulusStartTime);
            goTimes.push(rt);
            goCorrect++;
            circle.textContent = `${rt} ms`;
            flowTip.textContent = `${rt} ms`;
        } else {
            circle.textContent = '错误！';
            flowTip.textContent = '红色不应点击';
            flowTip.className = 'flow-tip text-red';
        }

        if (trial >= TOTAL_TRIALS) {
            endTest();
        } else {
            setTimeout(showInterval, getRandomDuration(MIN_INTERVAL_DURATION, MAX_INTERVAL_DURATION));
        }
    }

    function endTest() {
        isTestLocked = true;
        state = 'idle';

        const goRate = goCount ? Math.round((goCorrect / goCount) * 100) : 0;
        const noGoRate = noGoCount ? Math.round((noGoCorrect / noGoCount) * 100) : 0;
        const avgRT = goTimes.length ? Math.round(goTimes.reduce((a, b) => a + b, 0) / goTimes.length) : 0;

        document.getElementById('goRate').textContent = goRate + '%';
        document.getElementById('noGoRate').textContent = noGoRate + '%';
        document.getElementById('avgRT').textContent = avgRT === 0 ? '-- ms' : avgRT + ' ms';

        if (goRate > bestGoRate) bestGoRate = goRate;
        if (noGoRate > bestNoGoRate) bestNoGoRate = noGoRate;
        if (avgRT > 0 && avgRT < bestAvgRT) bestAvgRT = avgRT;

        saveBestToStorage();
        updateBestDisplay();

        circle.className = 'stimulus-circle circle-wait';
        circle.textContent = '完成';
        flowTip.textContent = '测试结束,等待重置';
        flowTip.className = 'flow-tip text-yellow';

        setTimeout(() => {
            isTestLocked = false;
            resetUI();
        }, 2000);
    }

    circle.addEventListener('mousedown', handleAction);
    circle.addEventListener('touchstart', handleAction, { passive: false });
    document.addEventListener('keydown', e => {
        if (e.code === 'Space') handleAction(e);
    });

    loadBestFromStorage();
    resetUI();
    updateBestDisplay();
})();
