# Expo demos (Have a Go, 23 Oct 2026)

Drop this whole `expo` folder into the repo. Everything is plain HTML, CSS and
JavaScript. No build step, no libraries, no internet needed except for the map
link on the photo page and the real Live CTF link.

Open `index.html` to get the list of demos.

Files:

- index.html / hub.css / hub.js   the menu page
- crack.html / crack.css / crack.js   password cracking counter
- deface.html / deface.css / deface.js   practice website to edit with DevTools
- movie.html / movie.css / movie.js   fake movie hacking screen
- photo.html / photo.css / photo.js   reads hidden camera and GPS data out of a photo
- samples.js   the eight sample photos for that demo, stored in the file itself
- photos/   the same eight photos as ordinary jpg files, if you want them elsewhere
- board.html / board.css / board.js   demo Live CTF leaderboard with made up players

To point demo 06 at the real Live CTF page, open hub.js and put the address in
LIVE_CTF_URL. Leave it empty and the card just says it is not set.

The sample photos have made up camera brands, dates and GPS coordinates written
into them. The coordinates are roughly the real spots, everything else is
invented. The last one is the same beach photo with all of that stripped out, so
you can show the two side by side.

To change or add samples, edit the jpgs in photos/ then rebuild samples.js. It is
just each file base64 encoded into a list.
