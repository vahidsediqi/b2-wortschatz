# B2 Wortschatz

Mobile flashcards for B2 German vocabulary, with English and Farsi on the back of each card.

## Add words

Edit `words.js`. Copy a line in the right list and change it. The comment at the top of the file explains each field. Then run `node tools/make-audio.js` on a Mac to record the new words. Commit and push, and GitHub Pages updates in about a minute.

## Login and saved progress

The Anmelden button saves the Gelernt, Schwer and Wichtig marks in a secret gist on the owner's GitHub account, so they are the same on every device. `sync.js` explains how it works. The password is never stored: it only decrypts a GitHub token (gist permission only) kept in the gist. The first login asks once for that token.

After changing `app.js`, `sync.js`, `words.js` or `styles.css`, raise the `?v=` number on their tags in `index.html`, so phones load the new files.
