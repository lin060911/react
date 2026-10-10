/* ============================================================
   balls.js — 定位反应测试（在多个符号中点击唯一的 ⨁）
   计时规则：以「本组符号真正绘制到屏幕」的那一帧为起点。
   ============================================================ */
(function () {
    'use strict';

    var box      = RL.$('gameContainer');
    var timerEl  = RL.$('timer');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');

    var currentAvgEl     = RL.$('currentAvg');
    var currentFastestEl = RL.$('currentFastest');
    var currentCountEl   = RL.$('currentCount');
    var bestAvgEl        = RL.$('bestAvg');

    var TOTAL_ROUNDS = 15;
    var MIN_SYMBOLS = 3;
    var MAX_SYMBOLS = 5;
    var COOLDOWN = 420;

    var sw = RL.Stopwatch(timerEl);

    var playing = false;
    var armed = false;        // 本组符号已上屏，处于可测量状态
    var cooling = false;
    var ended = false;
    var round = 0;
    var times = [];
    var pending = null;   // 待执行的下一步定时器

    var bestAvg = RL.store.get('balls.avg', 'reactionBestAvg');

    /* ---------- 渲染 ---------- */
    function renderCurrent() {
        currentAvgEl.textContent = RL.fmtMs(RL.avg(times));
        currentFastestEl.textContent = RL.fmtMs(RL.min(times));
        currentCountEl.textContent = times.length + ' / ' + TOTAL_ROUNDS;
    }

    function renderBest() { bestAvgEl.textContent = RL.fmtMs(bestAvg); }

    /* 符号尺寸跟着舞台一起放大（舞台现在占屏幕大部分高度） */
    function symbolSize() {
        var w = box.clientWidth || 1180;
        return Math.round(Math.max(52, Math.min(118, w / 11)));
    }

    /* ---------- 一轮 ---------- */
    function clearStage() {
        var nodes = box.querySelectorAll('.symbol');
        for (var i = 0; i < nodes.length; i++) nodes[i].remove();
    }

    function showRound() {
        if (!playing) return;
        clearStage();
        armed = false;
        sw.reset();

        var size = symbolSize();
        var count = RL.randInt(MIN_SYMBOLS, MAX_SYMBOLS);
        var correctIndex = RL.randInt(0, count - 1);
        var pts = RL.scatter(box, count, size);

        progress.textContent = '第 ' + (round + 1) + ' / ' + TOTAL_ROUNDS + ' 组 · 符号 ' + count + ' 个';

        for (var i = 0; i < count; i++) {
            var isCorrect = (i === correctIndex);
            var node = document.createElement('div');
            node.className = 'symbol';
            node.dataset.correct = isCorrect ? 'true' : 'false';
            node.style.width = size + 'px';
            node.style.height = size + 'px';
            node.style.left = pts[i].x + 'px';
            node.style.top = pts[i].y + 'px';
            node.style.fontSize = Math.round(size * 1.2) + 'px';
            /* ⨁（正确）/ ⨂（干扰）：U+2A01 / U+2A02。
               用内层 span 承载字形，方便 CSS 做垂直微调（见 .symbol > span）。 */
            var glyph = document.createElement('span');
            glyph.textContent = isCorrect ? '⨁' : '⨂';
            node.appendChild(glyph);
            node.addEventListener('click', onSymbolClick);
            node.addEventListener('touchstart', function (e) {
                e.preventDefault();
                onSymbolClick.call(this, e);
            }, { passive: false });
            /* 直接插入即可见：不使用淡入 / 缩放动画，避免影响反应计时 */
            box.appendChild(node);
        }

        /* 关键：起点取「符号已上屏」那一帧的时间戳 */
        RL.afterPaint(function (ts) {
            if (!playing || ended || armed) return;
            armed = true;
            sw.mark(ts || performance.now());
        });
    }

    function onSymbolClick(e) {
        e.stopPropagation();
        if (!playing || cooling || ended) return;
        if (!armed) return;                 // 未上屏的点击不计入成绩

        var cost = sw.stop();
        armed = false;
        var isCorrect = this.dataset.correct === 'true';

        var nodes = box.querySelectorAll('.symbol');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].classList.add(nodes[i].dataset.correct === 'true' ? 'correct' : 'wrong');
        }

        if (isCorrect) {
            times.push(cost);
            round++;
            renderCurrent();
            flowTip('正确！用时 ' + cost + ' ms', 'green');
            if (round >= TOTAL_ROUNDS) { cooling = true; pending = setTimeout(finish, COOLDOWN); return; }
            cooldown(function () { showRound(); });
        } else {
            flowTip('点错了，本组重来', 'red');
            cooldown(function () { showRound(); });
        }
    }

    function cooldown(next) {
        cooling = true;
        pending = setTimeout(function () {
            cooling = false;
            next();
        }, COOLDOWN);
    }

    /* ---------- 流程 ---------- */
    function startGame() {
        clearTimeout(pending);
        playing = true;
        armed = false;
        ended = false;
        cooling = false;
        round = 0;
        times = [];
        sw.reset();
        renderCurrent();
        clearStage();
        flowTip('测试开始！寻找并点击 ⨁', 'yellow');
        progress.textContent = '';
        pending = setTimeout(showRound, 420);
    }

    function abort(reason) {
        clearTimeout(pending);
        playing = false;
        armed = false;
        cooling = false;
        ended = true;
        sw.reset();
        clearStage();
        progress.textContent = '';
        flowTip(reason + ' · 按空格或点击屏幕重新开始', 'red');
    }

    function finish() {
        playing = false;
        armed = false;
        ended = true;
        cooling = false;      // 必须解锁，否则结束后点击 / 空格永远无法重开
        clearStage();
        sw.reset();

        var a = RL.avg(times);
        bestAvg = RL.betterLower(bestAvg, a);
        RL.store.set('balls.avg', Math.round(bestAvg));
        renderBest();

        progress.textContent = '测试完成 · 共 ' + TOTAL_ROUNDS + ' 组';
        flowTip('测试结束！平均 ' + Math.round(a) + ' ms · 按空格或点击屏幕重来', 'yellow');
    }

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (!playing && !cooling) return;
        abort('检测到切换窗口 · 本次作废');
    });

    RL.onActivate(function () {
        if (cooling) return;
        if (playing) return;
        startGame();
    });

    renderCurrent();
    renderBest();
})();
