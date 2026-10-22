(function () {
  "use strict";

  var board = document.getElementById("board");
  var feed = document.getElementById("feed");
  var clockEl = document.getElementById("clock");
  var solvedEl = document.getElementById("solved");

  var COLOURS = [
    "#ff2d78", "#4ab8ff", "#35e07a", "#ffc24b",
    "#b06bff", "#ff7a45", "#2fd8d0", "#f45b9b",
    "#8ad24a", "#5b7cff", "#ffa0c9", "#d9a441"
  ];

  var NAMES = [
    "Zara K", "Amelia T", "Noah P", "Priya S", "Jack W",
    "Mia L", "Oliver R", "Chloe N", "Liam D", "Isla M",
    "Ethan B", "Harper J"
  ];

  var CHALLENGES = [
    "Inspect the Page", "Love Letter", "Caesar Shift", "Layers",
    "Hidden Button", "Robots Say No", "Binary Name", "Base64 Basics",
    "Password Hunt", "Secret Comment", "Sneaky Cookie", "View Source"
  ];

  var players = [];
  var totalSolves = 0;
  var startTime = Date.now();
  var rowHeight = 70;

  function pad(n) {
    if (n < 10) {
      return "0" + n;
    }
    return "" + n;
  }

  function pointsFor(seconds) {
    return Math.round(500 + (500 * 120) / (120 + seconds));
  }

  function build() {
    var i;
    for (i = 0; i < NAMES.length; i = i + 1) {
      var el = document.createElement("div");
      el.className = "row";
      el.style.borderLeftColor = COLOURS[i % COLOURS.length];

      var rank = document.createElement("span");
      rank.className = "rank";

      var name = document.createElement("span");
      name.className = "name";
      name.textContent = NAMES[i];

      var chal = document.createElement("span");
      chal.className = "chal";

      var score = document.createElement("span");
      score.className = "score";

      el.appendChild(rank);
      el.appendChild(name);
      el.appendChild(chal);
      el.appendChild(score);
      board.appendChild(el);

      players.push({
        name: NAMES[i],
        colour: COLOURS[i % COLOURS.length],
        score: 0,
        solves: 0,
        last: 0,
        el: el,
        rankEl: rank,
        chalEl: chal,
        scoreEl: score
      });
    }
  }

  function sizeRows() {
    var available = board.clientHeight;
    var n = players.length;
    var h = Math.floor(available / n);

    if (h < 44) {
      h = 44;
    }
    if (h > 104) {
      h = 104;
    }

    rowHeight = h;

    var i;
    for (i = 0; i < players.length; i = i + 1) {
      players[i].el.style.height = (h - 8) + "px";
    }
  }

  function sorted() {
    var copy = players.slice();
    copy.sort(function (a, b) {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.last !== b.last) {
        return a.last - b.last;
      }
      return a.name < b.name ? -1 : 1;
    });
    return copy;
  }

  function render() {
    var order = sorted();
    var i;

    for (i = 0; i < order.length; i = i + 1) {
      var p = order[i];
      p.el.style.transform = "translateY(" + (i * rowHeight) + "px)";
      p.rankEl.textContent = (i + 1);
      p.scoreEl.textContent = p.score.toLocaleString("en-AU");
      p.chalEl.textContent = p.solves + " / " + CHALLENGES.length;

      var cls = "row";
      if (i === 0) {
        cls = cls + " top1";
      } else if (i === 1) {
        cls = cls + " top2";
      } else if (i === 2) {
        cls = cls + " top3";
      }
      p.el.className = cls;
    }
  }

  function flash(p, pts) {
    var base = p.el.className;
    p.el.className = base + " hit";

    var pop = document.createElement("span");
    pop.className = "pop";
    pop.textContent = "+" + pts;
    p.el.appendChild(pop);

    setTimeout(function () {
      p.el.className = base;
    }, 700);

    setTimeout(function () {
      if (pop.parentNode !== null) {
        pop.parentNode.removeChild(pop);
      }
    }, 1500);
  }

  function addFeed(name, challenge, pts) {
    var line = document.createElement("span");
    line.innerHTML = "<b>" + name + "</b> solved " + challenge + " <span class=\"pts\">+" + pts + "</span>";
    feed.innerHTML = "";
    feed.appendChild(line);
  }

  function solve() {
    var pool = [];
    var i;

    for (i = 0; i < players.length; i = i + 1) {
      if (players[i].solves < CHALLENGES.length) {
        pool.push(players[i]);
      }
    }

    if (pool.length === 0) {
      for (i = 0; i < players.length; i = i + 1) {
        players[i].score = 0;
        players[i].solves = 0;
      }
      totalSolves = 0;
      render();
      return;
    }

    var p = pool[Math.floor(Math.random() * pool.length)];
    var seconds = 18 + Math.floor(Math.random() * 280);
    var pts = pointsFor(seconds);
    var challenge = CHALLENGES[p.solves];

    p.score = p.score + pts;
    p.solves = p.solves + 1;
    p.last = Date.now();
    totalSolves = totalSolves + 1;

    render();
    flash(p, pts);
    addFeed(p.name, challenge, pts);
    solvedEl.textContent = totalSolves + " solves";
  }

  function tickClock() {
    var elapsed = Math.floor((Date.now() - startTime) / 1000);
    var mins = Math.floor(elapsed / 60);
    var secs = elapsed % 60;
    clockEl.textContent = pad(mins) + ":" + pad(secs);
  }

  function loop() {
    solve();
    var wait = 1200 + Math.floor(Math.random() * 2600);
    setTimeout(loop, wait);
  }

  function seed() {
    var i;
    var j;
    for (i = 0; i < players.length; i = i + 1) {
      var n = Math.floor(Math.random() * 4);
      for (j = 0; j < n; j = j + 1) {
        if (players[i].solves < CHALLENGES.length) {
          players[i].score = players[i].score + pointsFor(30 + Math.floor(Math.random() * 240));
          players[i].solves = players[i].solves + 1;
          totalSolves = totalSolves + 1;
        }
      }
    }
    solvedEl.textContent = totalSolves + " solves";
  }

  build();
  sizeRows();
  seed();
  render();

  window.addEventListener("resize", function () {
    sizeRows();
    render();
  });

  tickClock();
  setInterval(tickClock, 1000);
  setTimeout(loop, 1400);
}());
