(function () {
  "use strict";

  /* a serious offline cracking rig, roughly 100 billion guesses per second */
  var RATE = 100000000000;
  var ANIM_MS = 2600;
  var RESET_MS = 25000;

  var COMMON = [
    "password", "password1", "passw0rd", "123456", "1234567", "12345678",
    "123456789", "1234567890", "qwerty", "qwerty123", "abc123", "letmein",
    "monkey", "dragon", "iloveyou", "football", "soccer", "basketball",
    "baseball", "cricket", "minecraft", "roblox", "fortnite", "pokemon",
    "princess", "sunshine", "superman", "batman", "spiderman", "starwars",
    "pizza", "chocolate", "cookie", "unicorn", "rainbow", "hello", "welcome",
    "admin", "root", "test", "guest", "asdfgh", "zxcvbn", "qazwsx",
    "trustno1", "master", "shadow", "ninja", "hunter", "killer", "gaming",
    "gamer", "hacker", "secret", "summer", "winter", "purple", "orange",
    "banana", "apple", "google", "samsung", "netflix", "liverpool",
    "arsenal", "chelsea", "school", "teacher", "student", "homework",
    "australia", "sydney", "kangaroo", "michael", "jessica", "charlie",
    "jordan", "taylor", "harley", "loveme", "loveyou", "iloveu", "whatever",
    "freedom", "blink182", "soccer1", "11111111", "00000000", "aaaaaa"
  ];

  var form = document.getElementById("crack-form");
  var input = document.getElementById("pw");
  var stage = document.getElementById("stage");
  var candidates = document.getElementById("candidates");
  var countEl = document.getElementById("count");
  var barEl = document.getElementById("bar");
  var resultEl = document.getElementById("result");
  var verdictEl = document.getElementById("verdict");
  var timeEl = document.getElementById("time");
  var whyEl = document.getElementById("why");
  var againBtn = document.getElementById("again");

  var flickerTimer = null;
  var resetTimer = null;
  var frameId = null;

  function unleet(s) {
    var out = s;
    out = out.replace(/0/g, "o");
    out = out.replace(/1/g, "i");
    out = out.replace(/3/g, "e");
    out = out.replace(/4/g, "a");
    out = out.replace(/5/g, "s");
    out = out.replace(/7/g, "t");
    out = out.replace(/@/g, "a");
    out = out.replace(/\$/g, "s");
    return out;
  }

  function inList(word) {
    var i;
    for (i = 0; i < COMMON.length; i = i + 1) {
      if (COMMON[i] === word) {
        return true;
      }
    }
    return false;
  }

  function dictionaryHit(pw) {
    var low = pw.toLowerCase();
    var stripped = low.replace(/[^a-z]+$/g, "");
    var tries = [low, stripped, unleet(low), unleet(stripped)];
    var i;
    for (i = 0; i < tries.length; i = i + 1) {
      if (tries[i].length > 0 && inList(tries[i])) {
        return true;
      }
    }
    return false;
  }

  function charsetFor(pw) {
    var cs = "";
    if (/[a-z]/.test(pw)) {
      cs = cs + "abcdefghijklmnopqrstuvwxyz";
    }
    if (/[A-Z]/.test(pw)) {
      cs = cs + "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    }
    if (/[0-9]/.test(pw)) {
      cs = cs + "0123456789";
    }
    if (/[^a-zA-Z0-9]/.test(pw)) {
      cs = cs + "!@#$%^&*()-_=+[]{};:,.<>?";
    }
    if (cs === "") {
      cs = "abcdefghijklmnopqrstuvwxyz";
    }
    return cs;
  }

  function analyse(pw) {
    var pool = 0;
    var types = [];
    if (/[a-z]/.test(pw)) {
      pool = pool + 26;
      types.push("lowercase letters");
    }
    if (/[A-Z]/.test(pw)) {
      pool = pool + 26;
      types.push("capital letters");
    }
    if (/[0-9]/.test(pw)) {
      pool = pool + 10;
      types.push("numbers");
    }
    if (/[^a-zA-Z0-9]/.test(pw)) {
      pool = pool + 33;
      types.push("symbols");
    }
    if (pool === 0) {
      pool = 26;
    }

    var dict = dictionaryHit(pw);
    var guesses;
    if (dict) {
      guesses = 4000000;
    } else {
      guesses = Math.pow(pool, pw.length) / 2;
    }

    return {
      len: pw.length,
      pool: pool,
      types: types,
      dict: dict,
      guesses: guesses,
      secs: guesses / RATE
    };
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function bigYears(y) {
    if (y >= 1e15) {
      return "longer than the universe has existed";
    }
    if (y >= 1e12) {
      return round1(y / 1e12) + " trillion years";
    }
    if (y >= 1e9) {
      return round1(y / 1e9) + " billion years";
    }
    if (y >= 1e6) {
      return round1(y / 1e6) + " million years";
    }
    if (y >= 1000) {
      return round1(y / 1000) + " thousand years";
    }
    return Math.round(y) + " years";
  }

  function formatTime(secs) {
    if (secs < 0.002) {
      return "instantly";
    }
    if (secs < 1) {
      return "less than a second";
    }
    if (secs < 60) {
      return Math.round(secs) + " seconds";
    }
    if (secs < 3600) {
      return Math.round(secs / 60) + " minutes";
    }
    if (secs < 86400) {
      return Math.round(secs / 3600) + " hours";
    }
    if (secs < 2592000) {
      return Math.round(secs / 86400) + " days";
    }
    if (secs < 31557600) {
      return Math.round(secs / 2592000) + " months";
    }
    return bigYears(secs / 31557600);
  }

  function randomCandidate(cs, len) {
    var out = "";
    var i;
    var n = len;
    if (n > 24) {
      n = 24;
    }
    for (i = 0; i < n; i = i + 1) {
      out = out + cs.charAt(Math.floor(Math.random() * cs.length));
    }
    return out;
  }

  function explain(info) {
    var parts = [];
    var tip;

    if (info.dict) {
      parts.push("That one is on the list of passwords attackers try first, so the length does not matter at all.");
    } else {
      parts.push("It is " + info.len + " characters long and uses " + info.types.join(" and ") + ".");
    }

    if (info.secs < 3600) {
      tip = "Length beats cleverness. Four random words stuck together is far stronger than one word with numbers on the end.";
    } else if (info.secs < 31557600 * 100) {
      tip = "Add a few more characters and the time goes up enormously. Every extra character multiplies the work.";
    } else {
      tip = "That is the idea. Long and unpredictable beats short and tricky every time.";
    }

    parts.push(tip);
    return parts.join(" ");
  }

  function stopTimers() {
    if (flickerTimer !== null) {
      clearInterval(flickerTimer);
      flickerTimer = null;
    }
    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function reset() {
    stopTimers();
    stage.className = "stage hidden";
    resultEl.className = "result hidden";
    form.className = "entry";
    candidates.textContent = "";
    countEl.textContent = "0";
    barEl.style.width = "0";
    input.value = "";
    input.focus();
  }

  function showResult(pw, info) {
    stopTimers();
    stage.className = "stage hidden";
    resultEl.className = "result";

    var readable = formatTime(info.secs);

    if (info.secs < 3600) {
      verdictEl.className = "verdict bad";
      verdictEl.textContent = "CRACKED";
      timeEl.innerHTML = "We found it in <b>" + readable + "</b>";
    } else if (info.secs < 31557600 * 100) {
      verdictEl.className = "verdict mid";
      verdictEl.textContent = "NOT BAD";
      timeEl.innerHTML = "That would take <b>" + readable + "</b>";
    } else {
      verdictEl.className = "verdict good";
      verdictEl.textContent = "GOOD LUCK";
      timeEl.innerHTML = "That would take <b>" + readable + "</b>";
    }

    whyEl.textContent = explain(info);
    resetTimer = setTimeout(reset, RESET_MS);
  }

  function run(pw) {
    var info = analyse(pw);
    var cracked = info.secs < 3600;
    var cs = charsetFor(pw);

    var target;
    if (cracked) {
      target = info.guesses;
    } else {
      target = RATE * (ANIM_MS / 1000);
    }

    form.className = "entry hidden";
    resultEl.className = "result hidden";
    stage.className = "stage";
    barEl.style.width = "0";

    flickerTimer = setInterval(function () {
      candidates.textContent = randomCandidate(cs, info.len);
    }, 55);

    var start = null;

    function step(now) {
      if (start === null) {
        start = now;
      }
      var elapsed = now - start;
      var t = elapsed / ANIM_MS;
      if (t > 1) {
        t = 1;
      }

      var eased = t * t;
      var shown = Math.floor(target * eased);
      countEl.textContent = shown.toLocaleString("en-AU");

      var pct = (shown / info.guesses) * 100;
      if (pct > 100) {
        pct = 100;
      }
      if (pct < 0.4 && pct > 0) {
        pct = 0.4;
      }
      barEl.style.width = pct + "%";

      if (t < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        frameId = null;
        if (cracked) {
          clearInterval(flickerTimer);
          flickerTimer = null;
          candidates.textContent = pw;
        }
        setTimeout(function () {
          showResult(pw, info);
        }, 450);
      }
    }

    frameId = requestAnimationFrame(step);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var pw = input.value;
    if (pw.length === 0) {
      input.focus();
      return;
    }
    run(pw);
  });

  againBtn.addEventListener("click", reset);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      reset();
    }
  });

  input.focus();
}());
