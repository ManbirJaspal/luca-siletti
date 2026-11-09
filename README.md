# Luca Siletti — portfolio

Single-page portfolio for photographer and filmmaker Luca Siletti. One HTML file, no framework, no build step to run locally.

- `index.html` — the whole site (Three.js, GSAP + ScrollTrigger and Lenis, loaded from CDNs). Open it directly and it uses the photos from lucasiletti.com.
- `tools/build-images.mjs` — generates `img/NN-{900,1200,2000}.webp` from the originals and switches the page to those local files. Run `npm --prefix tools install && node tools/build-images.mjs` to do it by hand.
- `.github/workflows/pages.yml` — on every push to `main`, builds the photo files and deploys the site to GitHub Pages.
