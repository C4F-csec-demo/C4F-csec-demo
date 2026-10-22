(function () {
  "use strict";

  var out = document.getElementById("out");
  var hint = document.getElementById("hint");
  var granted = document.getElementById("granted");
  var truth = document.getElementById("truth");
  var truthBtn = document.getElementById("truth-btn");
  var truthClose = document.getElementById("truth-close");
  var clock = document.getElementById("clock");

  var MAX_CHARS = 7000;
  var CHUNK = 5;
  var GRANT_EVERY = 1100;

  var pos = 0;
  var typed = 0;
  var open = false;
  var grantTimer = null;

  var LINES = [
    "root@node-07:~# nmap -sS -A -T4 10.40.11.0/24",
    "Starting Nmap 7.94 ( https://nmap.org )",
    "Nmap scan report for gateway.internal (10.40.11.1)",
    "Host is up (0.00042s latency).",
    "PORT     STATE SERVICE    VERSION",
    "22/tcp   open  ssh        OpenSSH 9.2p1",
    "80/tcp   open  http       nginx 1.24.0",
    "443/tcp  open  ssl/http   nginx 1.24.0",
    "3306/tcp open  mysql      MySQL 8.0.36",
    "8080/tcp open  http-proxy Squid 5.7",
    "Service detection performed. 18 hosts scanned in 4.21 seconds",
    "",
    "root@node-07:~# ./sweep --target 10.40.11.23 --depth 4",
    "[  OK  ] handshake negotiated       rsa-sha2-512",
    "[  OK  ] session key exchanged      4096 bit",
    "[ WARN ] legacy cipher offered      ignoring",
    "[  OK  ] tunnel established         127.0.0.1:9050",
    "",
    "static int frame_decode(struct ctx *c, uint8_t *buf, size_t len)",
    "{",
    "    uint32_t magic = read_le32(buf);",
    "    if (magic != FRAME_MAGIC) {",
    "        return -EINVAL;",
    "    }",
    "    c->seq   = read_le32(buf + 4);",
    "    c->flags = read_le16(buf + 8);",
    "    if (c->flags & FLAG_COMPRESSED) {",
    "        len = inflate_block(c, buf + 12, len - 12);",
    "    }",
    "    memcpy(c->window, buf + 12, len);",
    "    return (int) len;",
    "}",
    "",
    "0x00401a20  55 48 89 e5 48 83 ec 20  89 7d ec 48 89 75 e0 8b   UH..H....}.H.u..",
    "0x00401a30  45 ec 83 f8 01 75 11 48  8b 45 e0 48 83 c0 08 48   E....u.H.E.H...H",
    "0x00401a40  8b 00 48 89 c7 e8 9c fe  ff ff eb 1f 8b 45 ec 83   ..H..........E..",
    "0x00401a50  f8 02 75 16 48 8b 45 e0  48 83 c0 10 48 8b 00 48   ..u.H.E.H...H..H",
    "",
    "[ 0.0012 ] mapping segment .text    0x400000  r-x",
    "[ 0.0031 ] mapping segment .data    0x601000  rw-",
    "[ 0.0044 ] resolving symbol table   412 entries",
    "[ 0.0071 ] patching GOT entry 0x18  -> 0x7ffd4410",
    "[ 0.0090 ] breakpoint hit at main+0x2c",
    "",
    "root@node-07:~# cat /var/log/relay/stream.log | grep -i anomaly",
    "2026-10-23 01:14:02  anomaly  queue depth 4120 exceeds threshold",
    "2026-10-23 01:14:07  anomaly  retransmit storm on link eth3",
    "2026-10-23 01:14:19  anomaly  checksum drift 0.004 percent",
    "",
    "transferring block 0412 of 9980  [####################------------]  52%",
    "transferring block 0413 of 9980  [####################------------]  52%",
    "transferring block 0414 of 9980  [#####################-----------]  53%",
    "",
    "async def pump(reader, writer, window=64):",
    "    pending = set()",
    "    while not reader.at_eof():",
    "        chunk = await reader.read(8192)",
    "        task = asyncio.create_task(handle(chunk))",
    "        pending.add(task)",
    "        if len(pending) >= window:",
    "            done, pending = await asyncio.wait(pending)",
    "    await writer.drain()",
    "",
    "SELECT u.id, u.handle, s.last_seen FROM users u",
    "  JOIN sessions s ON s.user_id = u.id",
    "  WHERE s.last_seen > NOW() - INTERVAL '15 minutes'",
    "  ORDER BY s.last_seen DESC LIMIT 200;",
    "",
    "-----BEGIN CERTIFICATE-----",
    "MIIDazCCAlOgAwIBAgIUQ9mPq2nTzK4xWvLb0hFd3RcYuEswDQYJKoZIhvcNAQEL",
    "BQAwRTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoM",
    "GEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAeFw0yNjAxMDExMjAwMDBaFw0yNzAx",
    "-----END CERTIFICATE-----",
    ""
  ];

  var BLOB = LINES.join("\n") + "\n";

  function pad(n) {
    if (n < 10) {
      return "0" + n;
    }
    return "" + n;
  }

  function tickClock() {
    var d = new Date();
    clock.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  }

  function showGranted() {
    granted.className = "granted";
    if (grantTimer !== null) {
      clearTimeout(grantTimer);
    }
    grantTimer = setTimeout(function () {
      granted.className = "granted hidden";
      grantTimer = null;
    }, 1300);
  }

  function emit() {
    if (open) {
      return;
    }

    if (hint !== null && hint.className !== "hint hidden") {
      hint.className = "hint hidden";
    }

    var piece = "";
    var i;
    for (i = 0; i < CHUNK; i = i + 1) {
      piece = piece + BLOB.charAt(pos);
      pos = pos + 1;
      if (pos >= BLOB.length) {
        pos = 0;
      }
    }

    var text = out.textContent + piece;
    if (text.length > MAX_CHARS) {
      text = text.slice(text.length - MAX_CHARS);
    }
    out.textContent = text;
    out.scrollTop = out.scrollHeight;

    typed = typed + CHUNK;
    if (typed >= GRANT_EVERY) {
      typed = 0;
      showGranted();
    }
  }

  function openTruth() {
    open = true;
    truth.className = "truth";
  }

  function closeTruth() {
    open = false;
    truth.className = "truth hidden";
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (open) {
        closeTruth();
      } else {
        openTruth();
      }
      return;
    }

    if (e.key === "F5" || e.key === "F11" || e.key === "F12" || e.key === "Tab") {
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    e.preventDefault();
    emit();
  });

  document.querySelector(".screen").addEventListener("click", function () {
    emit();
    emit();
    emit();
  });

  truthBtn.addEventListener("click", openTruth);
  truthClose.addEventListener("click", closeTruth);

  tickClock();
  setInterval(tickClock, 1000);
}());
