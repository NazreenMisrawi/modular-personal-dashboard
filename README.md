# Modular Personal Dashboard

## How to view

### Option 1: Single file (easiest)
Just open **standalone.html** by double-clicking it.  
Everything (CSS + JS) is embedded, so it works offline with no server.

### Option 2: Local server (recommended for development)
In this folder, run one of:

```bash
python3 -m http.server 8080
```

or

```bash
npx serve
```

Then open http://localhost:8080

## Files
- `standalone.html` — self-contained version (recommended for quick viewing)
- `index.html` + `styles.css` + `app.js` — modular version
- Data is stored in your browser's localStorage
