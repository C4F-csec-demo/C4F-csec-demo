(function () {
  "use strict";

  var howto = document.getElementById("howto");
  var hideBtn = document.getElementById("hide-howto");
  var showBtn = document.getElementById("show-howto");
  var enrol = document.querySelector(".enrol");

  if (hideBtn !== null) {
    hideBtn.addEventListener("click", function () {
      howto.className = "howto hidden";
      showBtn.className = "show-btn";
      document.body.className = "wide";
    });
  }

  if (showBtn !== null) {
    showBtn.addEventListener("click", function () {
      howto.className = "howto";
      showBtn.className = "show-btn hidden";
      document.body.className = "";
    });
  }

  if (enrol !== null) {
    enrol.addEventListener("click", function () {
      window.alert("This is a practice page, so nothing is being sold here.\n\nIn a real shop the price would be checked on the server, not taken from your browser. Changing it here only changes what you see on this screen.");
    });
  }
}());
