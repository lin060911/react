/* ============================================================
   HSline.js — 头线定位测试（FPS 头线快速点击）
   计时规则：以「小球真正绘制到屏幕」的那一帧为起点，
             以玩家点中小球为终点，避免把渲染延迟算进成绩。
   ============================================================ */
(function () {
    'use strict';

    var ball     = RL.$('targetBall');
    var box      = RL.$('targetContainer');
    var timerEl  = RL.$('timer');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');

    var currentFastestEl = RL.$('currentFastest');
    var currentAvgEl     = RL.$('currentAvg');
    var currentCorrectEl = RL.$('currentCorrect');
    var bestFastestEl    = RL.$('bestFastest');
    var bestAvgEl        = RL.$('bestAvg');
    var bestCorrectEl    = RL.$('bestCorrect');

    var START_DELAY = 500;    // 开始后小球首次出现的延时
    var TIMEOUT = 1000;
    var COOLDOWN = 260;
    var PADDING = 40;

    var sw = RL.Stopwatch(timerEl);

    var playing = false;      // 小球在场，可被点击
    var running = false;      // 整场测试进行中（含小球之间的间隔）
    var armed = false;        // 小球已上屏，处于可测量状态
    var ended = false;        // 本次测试已结束
    var times = [];
    var ballTimer = null;
    var timeoutTimer = null;

    var best = {
        fastest: RL.store.get('hs.fastest', 'mouseBestFastest'),
        avg: RL.store.get('hs.avg', 'mouseBestAvg'),
        correct: RL.store.get('hs.correct', 'mouseBestCorrect') || 0
    };

    /* ---------- 渲染 ---------- */
    function renderCurrent() {
        currentFastestEl.textContent = RL.fmtMs(RL.min(times));
        currentAvgEl.textContent = RL.fmtMs(RL.avg(times));
        currentCorrectEl.textContent = String(times.length);
        progress.textContent = times.length ? ('已命中 ' + times.length + ' 次') : '';
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
        RL.store.set('hs.fastest', Math.round(best.fastest));
        RL.store.set('hs.avg', Math.round(best.avg));
        RL.store.set('hs.correct', best.correct);
        renderBest();
    }

    /* ---------- 流程 ---------- */
    function clearTimers() {
        clearTimeout(ballTimer);
        clearTimeout(timeoutTimer);
    }

    /* 让小球在下一帧出现，并把那一帧作为计时起点 */
    function showBall() {
        if (ended || !running) return;
        armed = false;
        playing = true;
        var x = RL.rand(PADDING, Math.max(PADDING, box.clientWidth - PADDING));
        ball.style.left = x + 'px';
        ball.classList.remove('hidden');
        flowTip('快速点击目标小球！', 'yellow');

        RL.afterPaint(function (ts) {
            if (ended || !playing) return;
            armed = true;
            var start = ts || performance.now();
            sw.mark(start);
            clearTimeout(timeoutTimer);
            timeoutTimer = setTimeout(timeout, TIMEOUT);
        });
    }

    function timeout() {
        if (ended || !running) return;
        if (!armed) return;                 // 小球还没上屏，不计超时
        clearTimers();
        sw.stop();
        armed = false;
        playing = false;
        ball.classList.add('hidden');
        endGame('超时！' + TIMEOUT + ' ms 内未点击');
    }

    function startTest() {
        clearTimers();
        ball.classList.add('hidden');
        sw.reset();
        times = [];
        armed = false;
        playing = false;
        running = true;
        ended = false;
        renderCurrent();
        flowTip('准备开始…', 'yellow');
        ballTimer = setTimeout(showBall, START_DELAY);
    }

    function endGame(reason) {
        playing = false;
        running = false;
        armed = false;
        ended = true;
        clearTimers();
        sw.reset();
        ball.classList.add('hidden');
        saveBest();
        flowTip(reason + ' · 命中 ' + times.length + ' 次 · 按空格或点击屏幕重来', 'red');
    }

    /* ---------- 交互 ---------- */
    function hit(e) {
        e.preventDefault();
        e.stopPropagation();
        if (ended || !armed) return;        // 未上屏的点击不计入成绩

        var cost = sw.stop();
        clearTimeout(timeoutTimer);
        armed = false;
        playing = false;
        times.push(cost);
        ball.classList.add('hidden');
        renderCurrent();
        flowTip('命中！' + cost + ' ms', 'green');

        ballTimer = setTimeout(showBall, COOLDOWN);
    }

    ball.addEventListener('click', hit);
    ball.addEventListener('touchstart', hit, { passive: false });

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (!running) return;
        clearTimers();
        sw.reset();
        armed = false;
        playing = false;
        ball.classList.add('hidden');
        saveBest();
        endGame('检测到切换窗口 · 本次作废');
    });

    RL.onActivate(function () {
        if (running) return;
        startTest();
    });

    renderCurrent();
    renderBest();
})();
