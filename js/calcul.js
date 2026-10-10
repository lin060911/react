/* ============================================================
   calcul.js — 运算反应测试（算题 + 反应双线程）
   ============================================================ */
(function () {
    'use strict';

    var circle   = RL.$('reactionCircle');
    var eqEl     = RL.$('equation');
    var indicator= RL.$('reactionIndicator');
    var scoreEl  = RL.$('scoreDisplay');
    var feedback = RL.$('inputFeedback');
    var flowTip  = RL.Tip(RL.$('flowTip'));
    var progress = RL.$('progress');

    var currentCalcEl  = RL.$('currentCalcScore');
    var currentReactEl = RL.$('currentReactAvg');
    var bestCalcEl     = RL.$('bestCalcScore');
    var bestReactEl    = RL.$('bestReactAvg');

    var calcSw = RL.Stopwatch(RL.$('calcTimer'), '计算 ');
    var reactSw = RL.Stopwatch(RL.$('reactTimer'), '反应 ');

    var OPERATORS = ['+', '×'];
    var TOTAL_REACTIONS = 5;
    var MIN_REACT_DELAY = 2000;
    var MAX_REACT_DELAY = 5000;
    var MIN_CALC_QUESTIONS = 5;
    var NEXT_QUESTION_DELAY = 260;

    var playing = false;
    var reactPhase = false;
    var reactArmed = false;   // 绿色已上屏，可以按成绩计时
    var questionArmed = false; // 题目已上屏且尚未作答（防止重复计入同一题）
    var reactCount = 0;
    var nextReactTimer = null;
    var questionTimer = null;

    var calcTimes = [];
    var reactTimes = [];
    var calcCorrect = 0;
    var calcTotal = 0;
    var currentDigit = 0;

    var best = {
        score: Number(RL.store.get('calcul.score', 'dualCalcScore') || 0),
        speed: RL.store.get('calcul.speed', 'dualCalcSpeed'),
        acc: RL.store.get('calcul.accuracy', 'dualCalcAcc'),
        count: RL.store.get('calcul.count', 'dualCalcCount') || '--',
        reactAvg: RL.store.get('calcul.reactAvg', 'dualReactAvg')
    };

    /* ---------- 出题 ---------- */
    function generateEquation() {
        var op = RL.pick(OPERATORS);
        var a, b, result;
        if (op === '+') {
            a = RL.randInt(10, 89);
            b = RL.randInt(10, 89);
            result = a + b;
        } else {
            a = RL.randInt(2, 12);
            b = RL.randInt(2, 9);
            result = a * b;
        }
        /* 保证结果为两位数，隐藏个位 */
        while (result < 10 || result > 99) {
            if (op === '+') { b = RL.randInt(10, 89); result = a + b; }
            else { b = RL.randInt(2, 9); result = a * b; }
        }
        var s = String(result);
        currentDigit = Number(s[s.length - 1]);
        return { text: a + ' ' + op + ' ' + b + ' = ' + s[0] + '<span class="eq-box">□</span>', digit: currentDigit };
    }

    /* ---------- 渲染 ---------- */
    function renderScore() {
        scoreEl.textContent = '当前计算分数：' + calcScore();
        renderCurrent();
    }

    function renderCurrent() {
        var avgTime = RL.avg(calcTimes);
        var acc = calcTotal ? (calcCorrect / calcTotal) * 100 : null;
        currentCalcEl.textContent =
            (avgTime === null ? '--' : Math.round(avgTime) + 'ms') + ' / ' +
            (acc === null ? '--' : Math.round(acc) + '%') + ' / ' + calcTotal;
        currentReactEl.textContent = RL.fmtMs(RL.avg(reactTimes));
    }

    function renderBest() {
        bestCalcEl.textContent =
            (best.speed === null ? '--' : Math.round(best.speed) + 'ms') + ' / ' +
            (best.acc === null ? '--' : Math.round(best.acc) + '%') + ' / ' + best.count;
        bestReactEl.textContent = RL.fmtMs(best.reactAvg);
    }

    function renderProgress() {
        progress.textContent = '计算 ' + calcTotal + ' 题 · 反应 ' + reactCount + ' / ' + TOTAL_REACTIONS + ' 次';
    }

    var fbTimer = null;
    function flash(text, tone) {
        /* 反馈文字瞬时显示、定时清空，不使用缩放 / 淡出动画 */
        feedback.textContent = text;
        feedback.className = 'feedback text-' + tone;
        clearTimeout(fbTimer);
        fbTimer = setTimeout(function () { feedback.textContent = ''; }, 800);
    }

    function calcScore() {
        if (calcTimes.length < MIN_CALC_QUESTIONS) return 0;
        var a = RL.avg(calcTimes);
        if (!a) return 0;
        return Math.round((calcCorrect / calcTotal) * calcTimes.length * 1000000 / a);
    }

    /* ---------- 流程 ---------- */
    function clearTimers() {
        clearTimeout(nextReactTimer);
        clearTimeout(questionTimer);
    }

    function showQuestion() {
        if (!playing) return;
        var q = generateEquation();
        eqEl.innerHTML = q.text;
        calcTotal++;
        questionArmed = false;
        renderProgress();
        /* 答题计时以「题目已上屏」那一帧为起点；上屏前不接受作答 */
        RL.afterPaint(function (ts) {
            if (!playing) return;
            questionArmed = true;
            calcSw.mark(ts || performance.now());
        });
    }

    function startReactPhase() {
        if (!playing || reactPhase || reactCount >= TOTAL_REACTIONS) return;
        reactPhase = true;
        reactArmed = false;
        circle.classList.add('go');
        indicator.textContent = '立即点击！';
        /* 关键：起点取「绿色已上屏」那一帧的时间戳 */
        RL.afterPaint(function (ts) {
            if (!playing || !reactPhase) return;
            reactArmed = true;
            reactSw.mark(ts || performance.now());
        });
    }

    function scheduleNextReact() {
        if (!playing || reactCount >= TOTAL_REACTIONS) return;
        clearTimeout(nextReactTimer);
        nextReactTimer = setTimeout(startReactPhase, RL.rand(MIN_REACT_DELAY, MAX_REACT_DELAY));
    }

    function startGame() {
        clearTimers();
        calcSw.reset();
        reactSw.reset();
        playing = true;
        reactPhase = false;
        reactArmed = false;
        questionArmed = false;
        reactCount = 0;
        calcTimes = [];
        reactTimes = [];
        calcCorrect = 0;
        calcTotal = 0;
        circle.classList.remove('go');
        eqEl.textContent = '准备开始…';
        indicator.textContent = '注意圆形变绿！';
        flowTip('测试开始！一边算题一边盯着圆形', 'blue');
        renderScore();
        renderProgress();
        questionTimer = setTimeout(function () { showQuestion(); scheduleNextReact(); }, 900);
    }

    function endGame() {
        playing = false;
        reactPhase = false;
        reactArmed = false;
        questionArmed = false;
        clearTimers();
        calcSw.reset();
        reactSw.reset();
        circle.classList.remove('go');
        eqEl.textContent = '测试完成';
        indicator.textContent = '点击重新开始';

        renderCurrent();
        var score = calcScore();
        var avgTime = RL.avg(calcTimes);
        var acc = calcTotal ? (calcCorrect / calcTotal) * 100 : null;

        if (score > Number(best.score || 0)) {
            best.score = score;
            best.speed = avgTime;
            best.acc = acc;
            best.count = calcTotal;
            RL.store.set('calcul.score', score);
            RL.store.set('calcul.speed', Math.round(avgTime));
            RL.store.set('calcul.accuracy', Math.round(acc));
            RL.store.set('calcul.count', calcTotal);
        }
        var ra = RL.avg(reactTimes);
        if (ra !== null) {
            best.reactAvg = RL.betterLower(best.reactAvg, ra);
            RL.store.set('calcul.reactAvg', Math.round(best.reactAvg));
        }
        renderBest();

        flowTip('测试完成！计算分数 ' + score + ' · 平均反应 ' + Math.round(ra || 0) + ' ms · 按空格或点击重来', 'yellow');
    }

    /* ---------- 作答 ---------- */
    function submitDigit(digit) {
        /* 一题只能作答一次：questionArmed 在题目上屏时置位，作答瞬间清除。
           这样既能避免把 null 计时计入成绩，也避免在出下一题的间隔里
           重复提交同一题（准确率曾因此超过 100%）。 */
        if (!playing || !calcTotal || !questionArmed) return;
        questionArmed = false;

        var cost = calcSw.stop();
        calcTimes.push(cost);
        if (Number(digit) === currentDigit) {
            calcCorrect++;
            flash('✓ 正确', 'green');
        } else {
            flash('✗ 错误', 'red');
        }
        renderScore();
        clearTimeout(questionTimer);
        questionTimer = setTimeout(showQuestion, NEXT_QUESTION_DELAY);
    }

    function submitReaction() {
        if (!playing || !reactPhase || !reactArmed) return;
        reactArmed = false;
        var cost = reactSw.stop();
        reactTimes.push(cost);
        reactCount++;
        reactPhase = false;
        circle.classList.remove('go');
        indicator.textContent = '继续计算…';
        flowTip('第 ' + reactCount + ' 次反应：' + cost + ' ms', 'green');
        renderScore();
        renderProgress();
        if (reactCount >= TOTAL_REACTIONS) { endGame(); return; }
        scheduleNextReact();
    }

    /* ---------- 失焦保护 ---------- */
    RL.onFocusLost(function () {
        if (!playing) return;
        endGame();
        flowTip('检测到切换窗口 · 本次作废 · 按空格或点击屏幕重新开始', 'red');
    });

    /* ---------- 交互 ---------- */
    RL.onActivate(function () {
        if (!playing) { startGame(); return; }
        if (reactPhase) submitReaction();
    });

    document.addEventListener('keydown', function (e) {
        var m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
        if (!m) return;
        e.preventDefault();
        submitDigit(m[1]);
    });

    var keys = document.querySelectorAll('.key');
    for (var i = 0; i < keys.length; i++) {
        keys[i].addEventListener('click', function (e) {
            e.stopPropagation();
            submitDigit(this.dataset.key);
        });
        keys[i].addEventListener('touchstart', function (e) {
            e.preventDefault();
            e.stopPropagation();
            submitDigit(this.dataset.key);
        }, { passive: false });
    }

    renderCurrent();
    renderBest();
    renderScore();
})();
