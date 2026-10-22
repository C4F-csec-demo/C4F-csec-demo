(function () {
  "use strict";

  var drop = document.getElementById("drop");
  var fileInput = document.getElementById("file");
  var results = document.getElementById("results");
  var thumb = document.getElementById("thumb");
  var filenameEl = document.getElementById("filename");
  var verdictEl = document.getElementById("verdict");
  var factsEl = document.getElementById("facts");
  var mapwrap = document.getElementById("mapwrap");
  var maplink = document.getElementById("maplink");
  var lessonEl = document.getElementById("lesson");
  var againBtn = document.getElementById("again");
  var samplesEl = document.getElementById("samples");
  var tilesEl = document.getElementById("sample-tiles");

  var TYPE_SIZE = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  var IFD0_TAGS = {
    270: "Description",
    271: "Make",
    272: "Model",
    274: "Orientation",
    305: "Software",
    306: "DateTime",
    315: "Artist",
    33432: "Copyright"
  };

  var EXIF_TAGS = {
    33434: "ExposureTime",
    33437: "FNumber",
    34855: "ISO",
    36867: "DateTimeOriginal",
    37386: "FocalLength",
    40962: "PixelX",
    40963: "PixelY",
    42035: "LensMake",
    42036: "LensModel"
  };

  function readValue(view, tiffStart, entryOffset, little) {
    var type = view.getUint16(entryOffset + 2, little);
    var count = view.getUint32(entryOffset + 4, little);

    if (type < 1 || type > 12) {
      return null;
    }

    var total = TYPE_SIZE[type] * count;
    var valueOffset;

    if (total <= 4) {
      valueOffset = entryOffset + 8;
    } else {
      valueOffset = tiffStart + view.getUint32(entryOffset + 8, little);
    }

    if (valueOffset < 0 || valueOffset + total > view.byteLength) {
      return null;
    }

    var out = [];
    var i;

    if (type === 2) {
      var s = "";
      for (i = 0; i < count; i = i + 1) {
        var code = view.getUint8(valueOffset + i);
        if (code === 0) {
          break;
        }
        s = s + String.fromCharCode(code);
      }
      return s.replace(/^\s+|\s+$/g, "");
    }

    for (i = 0; i < count; i = i + 1) {
      var at = valueOffset + i * TYPE_SIZE[type];
      if (type === 1 || type === 6 || type === 7) {
        out.push(view.getUint8(at));
      } else if (type === 3) {
        out.push(view.getUint16(at, little));
      } else if (type === 4) {
        out.push(view.getUint32(at, little));
      } else if (type === 9) {
        out.push(view.getInt32(at, little));
      } else if (type === 5) {
        var num = view.getUint32(at, little);
        var den = view.getUint32(at + 4, little);
        if (den === 0) {
          out.push(0);
        } else {
          out.push(num / den);
        }
      } else if (type === 10) {
        var snum = view.getInt32(at, little);
        var sden = view.getInt32(at + 4, little);
        if (sden === 0) {
          out.push(0);
        } else {
          out.push(snum / sden);
        }
      } else {
        out.push(view.getUint8(at));
      }
    }

    if (out.length === 1) {
      return out[0];
    }
    return out;
  }

  function readIfd(view, tiffStart, ifdOffset, little) {
    var tags = {};

    if (ifdOffset + 2 > view.byteLength) {
      return tags;
    }

    var count = view.getUint16(ifdOffset, little);
    var i;

    for (i = 0; i < count; i = i + 1) {
      var entry = ifdOffset + 2 + i * 12;
      if (entry + 12 > view.byteLength) {
        break;
      }
      var tag = view.getUint16(entry, little);
      tags[tag] = readValue(view, tiffStart, entry, little);
    }

    return tags;
  }

  function readTiff(view, tiffStart) {
    if (tiffStart + 8 > view.byteLength) {
      return null;
    }

    var order = view.getUint16(tiffStart);
    var little;

    if (order === 0x4949) {
      little = true;
    } else if (order === 0x4D4D) {
      little = false;
    } else {
      return null;
    }

    if (view.getUint16(tiffStart + 2, little) !== 0x002A) {
      return null;
    }

    var firstIfd = view.getUint32(tiffStart + 4, little);
    var ifd0 = readIfd(view, tiffStart, tiffStart + firstIfd, little);

    var exif = {};
    var gps = {};

    if (ifd0[34665] !== undefined && typeof ifd0[34665] === "number") {
      exif = readIfd(view, tiffStart, tiffStart + ifd0[34665], little);
    }

    if (ifd0[34853] !== undefined && typeof ifd0[34853] === "number") {
      gps = readIfd(view, tiffStart, tiffStart + ifd0[34853], little);
    }

    return { ifd0: ifd0, exif: exif, gps: gps };
  }

  function findExif(buffer) {
    var view = new DataView(buffer);

    if (view.byteLength < 4) {
      return null;
    }

    if (view.getUint16(0) !== 0xFFD8) {
      return null;
    }

    var offset = 2;

    while (offset + 4 < view.byteLength) {
      if (view.getUint8(offset) !== 0xFF) {
        return null;
      }

      var marker = view.getUint8(offset + 1);

      if (marker === 0xD8 || marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7)) {
        offset = offset + 2;
        continue;
      }

      if (marker === 0xDA || marker === 0xD9) {
        return null;
      }

      var size = view.getUint16(offset + 2);

      if (marker === 0xE1) {
        var tag = "";
        var i;
        for (i = 0; i < 4; i = i + 1) {
          tag = tag + String.fromCharCode(view.getUint8(offset + 4 + i));
        }
        if (tag === "Exif") {
          return readTiff(view, offset + 10);
        }
      }

      offset = offset + 2 + size;
    }

    return null;
  }

  function dms(parts, ref) {
    if (parts === null || parts === undefined) {
      return null;
    }

    var d = 0;
    var m = 0;
    var s = 0;

    if (typeof parts === "number") {
      d = parts;
    } else {
      d = parts[0];
      if (parts.length > 1) {
        m = parts[1];
      }
      if (parts.length > 2) {
        s = parts[2];
      }
    }

    var dec = d + m / 60 + s / 3600;

    if (ref === "S" || ref === "W") {
      dec = -dec;
    }

    return dec;
  }

  function fmtSize(bytes) {
    if (bytes < 1024) {
      return bytes + " bytes";
    }
    if (bytes < 1048576) {
      return Math.round(bytes / 1024) + " KB";
    }
    return (Math.round(bytes / 104857.6) / 10) + " MB";
  }

  function fmtDate(raw) {
    if (typeof raw !== "string") {
      return null;
    }
    var m = raw.match(/^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/);
    if (m === null) {
      return raw;
    }
    return m[3] + "/" + m[2] + "/" + m[1] + " at " + m[4] + ":" + m[5];
  }

  function addFact(label, value, hot) {
    var row = document.createElement("div");
    var dt = document.createElement("dt");
    var dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    if (hot === true) {
      dd.className = "hot";
    }
    row.appendChild(dt);
    row.appendChild(dd);
    factsEl.appendChild(row);
  }

  function show(file, buffer, previewUri) {
    factsEl.innerHTML = "";
    mapwrap.className = "mapwrap hidden";

    var data = findExif(buffer);
    var found = 0;
    var hasGps = false;

    addFact("File", file.name.length > 34 ? file.name.slice(0, 34) + "..." : file.name);
    addFact("Size", fmtSize(file.size));

    if (data !== null) {
      var ifd0 = data.ifd0;
      var exif = data.exif;
      var gps = data.gps;

      var make = ifd0[271];
      var model = ifd0[272];

      if (typeof make === "string" && make !== "") {
        addFact("Camera brand", make, true);
        found = found + 1;
      }

      if (typeof model === "string" && model !== "") {
        addFact("Exact device", model, true);
        found = found + 1;
      }

      var when = fmtDate(exif[36867]);
      if (when === null) {
        when = fmtDate(ifd0[306]);
      }
      if (when !== null) {
        addFact("Taken on", when, true);
        found = found + 1;
      }

      if (typeof ifd0[305] === "string" && ifd0[305] !== "") {
        addFact("Software", ifd0[305]);
        found = found + 1;
      }

      if (typeof ifd0[315] === "string" && ifd0[315] !== "") {
        addFact("Photographer", ifd0[315], true);
        found = found + 1;
      }

      if (typeof exif[34855] === "number") {
        addFact("ISO", exif[34855]);
        found = found + 1;
      }

      if (typeof exif[33437] === "number") {
        addFact("Aperture", "f/" + (Math.round(exif[33437] * 10) / 10));
        found = found + 1;
      }

      if (typeof exif[42036] === "string" && exif[42036] !== "") {
        addFact("Lens", exif[42036]);
        found = found + 1;
      }

      var lat = dms(gps[2], gps[1]);
      var lon = dms(gps[4], gps[3]);

      if (lat !== null && lon !== null && isFinite(lat) && isFinite(lon)) {
        hasGps = true;
        found = found + 1;
        addFact("Latitude", lat.toFixed(6), true);
        addFact("Longitude", lon.toFixed(6), true);
        maplink.setAttribute("href", "https://www.openstreetmap.org/?mlat=" + lat.toFixed(6) + "&mlon=" + lon.toFixed(6) + "#map=17/" + lat.toFixed(6) + "/" + lon.toFixed(6));
        mapwrap.className = "mapwrap";
      }
    }

    if (hasGps) {
      verdictEl.className = "verdict found";
      verdictEl.textContent = "This photo knows exactly where it was taken";
      lessonEl.textContent = "Nobody typed any of that in. The camera wrote it into the file on its own, and it travels with the photo wherever it goes. Post the photo somewhere that keeps this data and you have told everyone where you were, when, and on what phone. Most big sites strip it out now, but plenty of smaller ones do not, and a photo sent straight to someone keeps the lot.";
    } else if (found > 0) {
      verdictEl.className = "verdict some";
      verdictEl.textContent = "No location, but still a few things";
      lessonEl.textContent = "No coordinates in this one, but the camera still left its name, the time and a few settings behind. None of that was typed in by a person. It is worth knowing that a file is never just the picture you can see.";
    } else {
      verdictEl.className = "verdict clean";
      verdictEl.textContent = "Nothing hidden in this one";
      lessonEl.textContent = "Either this photo never had extra data, or something stripped it. Screenshots and photos saved off Instagram, Snapchat or WhatsApp usually come out clean like this, because those apps remove it before sending. Try a photo taken straight off a phone camera and you will usually see a lot more.";
    }

    filenameEl.textContent = file.type + " loaded in your browser";
    thumb.setAttribute("src", previewUri);

    drop.className = "drop hidden";
    samplesEl.className = "samples hidden";
    results.className = "results";
  }

  function handle(file) {
    if (!file) {
      return;
    }

    if (file.type.indexOf("image") !== 0) {
      window.alert("That does not look like an image. Try a photo.");
      return;
    }

    var bytesReader = new FileReader();
    bytesReader.onload = function (be) {
      var buffer = be.target.result;
      var uriReader = new FileReader();
      uriReader.onload = function (ue) {
        show(file, buffer, ue.target.result);
      };
      uriReader.readAsDataURL(file);
    };
    bytesReader.readAsArrayBuffer(file);
  }

  function dataUriToBuffer(uri) {
    var binary = window.atob(uri.slice(uri.indexOf(",") + 1));
    var len = binary.length;
    var bytes = new Uint8Array(len);
    var i;
    for (i = 0; i < len; i = i + 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function sampleHandler(sample) {
    return function () {
      var uri = "data:image/jpeg;base64," + sample.data;
      var buffer = dataUriToBuffer(uri);
      var meta = {
        name: sample.name,
        size: buffer.byteLength,
        type: "image/jpeg"
      };
      show(meta, buffer, uri);
    };
  }

  function buildTiles() {
    if (tilesEl === null) {
      return;
    }
    if (typeof window.SAMPLE_PHOTOS === "undefined") {
      return;
    }

    var list = window.SAMPLE_PHOTOS;
    var i;

    for (i = 0; i < list.length; i = i + 1) {
      var sample = list[i];

      var btn = document.createElement("button");
      btn.className = "tile";
      btn.setAttribute("type", "button");

      var img = document.createElement("img");
      img.setAttribute("src", "data:image/jpeg;base64," + sample.data);
      img.setAttribute("alt", sample.label);

      var cap = document.createElement("span");
      cap.textContent = sample.label;

      btn.appendChild(img);
      btn.appendChild(cap);
      btn.addEventListener("click", sampleHandler(sample));
      tilesEl.appendChild(btn);
    }
  }

  drop.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files.length > 0) {
      handle(fileInput.files[0]);
    }
  });

  drop.addEventListener("dragover", function (e) {
    e.preventDefault();
    drop.className = "drop over";
  });

  drop.addEventListener("dragleave", function () {
    drop.className = "drop";
  });

  drop.addEventListener("drop", function (e) {
    e.preventDefault();
    drop.className = "drop";
    if (e.dataTransfer.files.length > 0) {
      handle(e.dataTransfer.files[0]);
    }
  });

  document.addEventListener("dragover", function (e) {
    e.preventDefault();
  });

  document.addEventListener("drop", function (e) {
    e.preventDefault();
  });

  buildTiles();

  againBtn.addEventListener("click", function () {
    results.className = "results hidden";
    drop.className = "drop";
    samplesEl.className = "samples";
    fileInput.value = "";
  });
}());
