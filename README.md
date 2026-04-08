# video2pdf.ai — Landing Page

Static landing page for Video2PDF with placeholder App Store / Google Play links.

## Pages

- `/` — Main landing page
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

## Deploy

### Vercel (recommended)
```bash
npm i -g vercel
vercel
# Set custom domain: vercel domains add video2pdf.ai
```

### Netlify
```bash
npm i -g netlify-cli
netlify deploy --prod --dir .
# Set custom domain in Netlify dashboard
```

### GitHub Pages
Push to a repo, enable Pages in Settings → point to root of `main` branch.

## Update Store Links

Edit `index.html` and replace the `href="#"` on the two store buttons:

```html
<a href="https://apps.apple.com/app/video2pdf/idXXXXXXXXXX" class="store-btn" id="app-store-link">
<a href="https://play.google.com/store/apps/details?id=com.video2pdf.app" class="store-btn" id="play-store-link">
```
