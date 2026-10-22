(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* BEN: put the address of the real Live CTF page between the quotes.  */
  /* Leave it empty and card 06 will just tell you it is not set yet.    */
  /* ------------------------------------------------------------------ */

  var LIVE_CTF_URL = "";

  var card = document.getElementById("real-ctf");

  if (card === null) {
    return;
  }

  if (LIVE_CTF_URL === "") {
    card.addEventListener("click", function (e) {
      e.preventDefault();
      window.alert("The real Live CTF link is not set yet. Open hub.js and put the address in LIVE_CTF_URL.");
    });
    return;
  }

  card.setAttribute("href", LIVE_CTF_URL);
  card.className = "card";
}());
