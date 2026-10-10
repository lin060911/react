/* ============================================================
   arrow.js — 箭头反应测试（方向键 / WASD / 滑动）
   计时规则：以「箭头真正绘制到屏幕」的那一帧为起点。
   ============================================================ */
(function () {
    'use strict';

    var arrowEl  = RL.$('arrow');
    var timerEl  = RL.$('timer');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');

    var currentFastestEl = RL.$('currentFastest');
    var currentAvgEl     = RL.$('currentAvg');
    var currentCorrectEl = RL.$('currentCorrect');
    var bestFastestEl    = RL.$('bestFastest');
    var bestAvgEl        = RL.$('bestAvg');
    var bestCorrectEl    = RL.$('bestCorrect');

    var DIRECTIONS = ['up', 'down', 'left', 'right'];
    var SYMBOLS = { up: '▲', down: '▼', left: '◀', right: '▶' };
    var KEY_MAP = {
        ArrowUp: 'up', KeyW: 'up',
        ArrowDown: 'down', KeyS: 'down',
        ArrowLeft: 'left', KeyA: 'left',
        ArrowRight: 'right', KeyD: 'right'
    };

    var MIN_DELAY = 220;
    var MAX_DELAY = 620;
    var TIMEOUT = 600;
    var COOLDOWN = 320;
    var SWIPE_THRESHOLD = 28;

    var sw = RL.Stopwatch(timerEl);

    var playing = false;      // 箭头在场，可作答
    var running = false;      // 整场测试进行中（含箭头之间的间隔）
    var armed = false;        // 箭头已上屏，处于可测量状态
    var direction = '';
    var times = [];
    var nextTimer = null;
    var timeoutTimer = null;
    var msgTimer = null;
    var touchOrigin = null;

    var best = {
        fastest: RL.store.get('arrow.fastest', 'bestFastest'),
        avg: RL.store.get('arrow.avg', 'bestAvg'),
        correct: RL.store.get('arrow.correct', 'bestCorrect') || 0
    };

    /* ---------- 渲染 ---------- */
    function renderArrow(dir) {
        if (!dir) { arrowEl.className = 'arrow hidden'; arrowEl.textContent = ''; return; }
        /* 状态瞬时切换：箭头不做淡入 / 缩放过渡 */
        arrowEl.className = 'arrow ' + dir;
        arrowEl.textContent = SYMBOLS[dir];
    }

    function renderCurrent() {
        currentFastestEl.textContent = RL.fmtMs(RL.min(times));
        currentAvgEl.textContent = RL.fmtMs(RL.avg(times));
        currentCorrectEl.textContent = String(times.length);
        progress.textContent = running ? ('已正确 ' + times.length + ' 次') : '';
    }

    function renderBest() {
        bestFastestEl.textContent = RL.fmtMs(best.fastest);
        bestAvgEl.textContent = RL.fmtMs(best.avg);
        bestCorrectEl.textContent = String(best.correct || 0);
    }

    function saveBest() {
        var f = RL.min(times), a = RL.avg(times);
        if (f === null) return;
        best.fastest = RL.betterLower(best.fastest, f);
        best.avg = RL.betterLower(best.avg, a);
        best.correct = RL.betterHigher(best.correct, times.length);
        RL.store.set('arrow.fastest', Math.round(best.fastest));
        RL.store.set('arrow.avg', Math.round(best.avg));
        RL.store.set('arrow.correct', best.correct);
        renderBest();
    }

    /* ---------- 流程 ---------- */
    function clearTimers() {
        clearTimeout(nextTimer);
        clearTimeout(timeoutTimer);
        clearTimeout(msgTimer);
    }

    function showArrow() {
        if (!running) return;
        armed = false;
        playing = true;
        direction = RL.pick(DIRECTIONS);
        renderArrow(direction);
        flowTip('按对应方向键', 'yellow');

        /* 关键：起点取「箭头已上屏」那一帧的时间戳 */
        RL.afterPaint(function (ts) {
            if (!running || !playing || armed) return;
            armed = true;
            sw.mark(ts || performance.now());
            clearTimeout(timeoutTimer);
            timeoutTimer = setTimeout(function () { endGame('超时！' + TIMEOUT + ' ms 内未操作'); }, TIMEOUT);
        });
    }

    function scheduleNext() {
        clearTimeout(nextTimer);
        nextTimer = setTimeout(showArrow, RL.rand(MIN_DELAY, MAX_DELAY));
    }

    function startTest() {
        clearTimers();
        renderArrow('');
        sw.reset();
        times = [];
        running = true;
        playing = false;
        armed = false;
        direction = '';
        renderCurrent();
        flowTip('准备开始…', 'yellow');
        nextTimer = setTimeout(showArrow, 500);
    }

    function endGame(reason) {
        running = false;
        playing = false;
        armed = false;
        clearTimers();
        sw.reset();
        renderArrow('');
        renderCurrent();
        saveBest();
        progress.textContent = '';
        flowTip(reason + ' · 正确 ' + times.length + ' 次 · 按空格或点击屏幕重来', 'red');
    }

    /* ---------- 作答 ---------- */
    function answer(input) {
        if (!running || !playing || !armed || !direction) return;
        armed = false;
        var cost = sw.stop();
        clearTimeout(timeoutTimer);
        renderArrow('');
        playing = false;

        if (input === direction) {
            times.push(cost);
            renderCurrent();
            flowTip('正确！' + cost + ' ms', 'green');
            scheduleNext();
        } else {
            flowTip('方向错误！测试结束 · 最后用时 ' + cost + ' ms', 'red');
            saveBest();
            running = false;
            clearTimeout(msgTimer);
            msgTimer = setTimeout(function () {
                if (running) return;      // 期间已经开始新一轮，别覆盖新提示
                flowTip('方向错误，测试结束 · 正确 ' + times.length + ' 次 · 按空格或点击屏幕重来', 'red');
            }, 900);
        }
    }

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (!running) return;
        endGame('检测到切换窗口 · 本次作废');
    });

    RL.onActivate(function () {
        if (playing) return;          // 箭头在场时，点击屏幕不当作开始
        if (running) return;
        startTest();
    });

    document.addEventListener('keydown', function (e) {
        var dir = KEY_MAP[e.code];
        if (!dir) return;
        e.preventDefault();
        answer(dir);
    });

    /* 移动端：滑动作答 */
    document.addEventListener('touchstart', function (e) {
        var t = e.touches[0];
        touchOrigin = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!touchOrigin) return;
        var t = e.changedTouches[0];
        var dx = t.clientX - touchOrigin.x;
        var dy = t.clientY - touchOrigin.y;
        touchOrigin = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;   // 轻点视为开始
        answer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    }, { passive: true });

    renderCurrent();
    renderBest();
})();
