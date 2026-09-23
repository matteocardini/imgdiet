# imgdiet

**How much weight could this site's images lose?**

One command, one number. Point it at a URL or a folder and it finds the images that are too big, too heavy or in a format from 2005, and tells you what you would save by fixing them.

[![CI](https://github.com/matteocardini/imgdiet/actions/workflows/ci.yml/badge.svg)](https://github.com/matteocardini/imgdiet/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/imgdiet)](https://www.npmjs.com/package/imgdiet)
![license](https://img.shields.io/badge/license-MIT-blue)

```bash
npx imgdiet example.com
```

```
https://example.com/

hero.jpg 1.4 MB, 4000×2500
  ✕ 4000px wide, shown at most at 1600px  (−896 kB)
  ! JPEG could be WebP or AVIF  (−151 kB)
  ✕ 1.4 MB for one image

logo.png 700 kB, 2400×1200
  ✕ 2400px wide, shown at most at 1800px  (−306 kB)
  ! Large PNG: photos belong in JPEG, WebP or AVIF
  · No width and height in the markup, so the page jumps while loading

4 images, 2.1 MB in total.
Could lose about 1.6 MB (74%) by resizing and converting.
```

No install, no config, no account, no API key.

## What it looks at

| Check | Why it matters |
| --- | --- |
| Wider than the layout uses | A 4000px photo in an 800px slot is the most common way to waste a megabyte |
| JPEG, PNG or GIF | WebP and AVIF usually cut 30% to 50% off the same picture |
| Very large PNG | A photo saved as PNG is several times heavier than it needs to be |
| Heavy files | One image over the budget slows the whole page |
| No width and height in the markup | The page jumps around while loading |

It reads only the first kilobytes of each file, enough for the header, then drops the connection. Checking a page costs a fraction of loading it.

## Options

```
npx imgdiet <url|folder> [options]

--top <n>        How many images to list (default 10)
--max-width <n>  Widest an image should be when the page does not say (default 1800)
--budget <kb>    Size above which an image is worth a look (default 200)
--json           Print the report as JSON
--fail-over <kb> Exit 1 when the total saving is above this
--no-color       Plain output, for logs and CI
```

Exit codes: `0` fine, `1` over the limit set with `--fail-over`, `2` the page or folder could not be read.

## In a pipeline

Keep a page-weight budget honest on every deploy:

```yaml
- run: npx imgdiet https://staging.example.com --no-color --fail-over 500
```

## On a folder

Before uploading a batch of photos to a site:

```bash
npx imgdiet ./wp-content/uploads/2026 --top 20
```

## As a library

```bash
npm install imgdiet
```

```ts
import { fromUrl, analyze, buildReport } from "imgdiet";

const found = await fromUrl("https://example.com");
const report = buildReport(found.source, found.images.map((i) => analyze(i)), found.failed);

console.log(report.totalSaving); // bytes
```

`findImages`, `readFormat`, `readDimensions` and `analyze` are pure functions: give them HTML or a header and they give you results, with no network involved.

## About the estimates

The savings are estimates, not measurements. Resizing is calculated from the area ratio; format conversion uses the ratios those formats usually achieve on real photos (30% for JPEG, 50% for PNG). The number tells you where to spend your afternoon, not what the file will weigh to the byte.

It does not run a browser, so it cannot know the exact rendered size of an image. It uses the `width` attribute and the `sizes` attribute when they are there, and a maximum width when they are not.

## Development

```bash
npm install
npm test
npm run dev -- example.com   # run the CLI from source
npm run build
```

## License

MIT
