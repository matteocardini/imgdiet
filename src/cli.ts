#!/usr/bin/env node
import { stat } from "node:fs/promises";
import { analyze, defaultBudget, type Budget } from "./analyze.js";
import { CollectError, fromFolder, fromUrl } from "./collect.js";
import { buildReport, formatReport } from "./report.js";

const HELP = `imgdiet - how much weight a site's images could lose

Usage
  npx imgdiet <url|folder> [options]

Options
  --top <n>        How many images to list (default 10)
  --max-width <n>  Widest an image should be when the page does not say (default 1800)
  --budget <kb>    Size above which an image is worth a look (default 200)
  --json           Print the report as JSON
  --fail-over <kb> Exit 1 when the total saving is above this
  --no-color       Plain output, for logs and CI
  -h, --help       Show this help
  -v, --version    Show the version

Examples
  npx imgdiet example.com
  npx imgdiet ./public/images --top 20
  npx imgdiet example.com --fail-over 500
`;

async function main(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("-")));
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? Number(argv[index + 1]) : undefined;
  };
  const target = argv.find((a, i) => !a.startsWith("-") && !isValueOf(argv, i));

  if (flags.has("-h") || flags.has("--help") || !target) {
    process.stdout.write(HELP);
    process.exit(target ? 0 : 2);
  }
  if (flags.has("-v") || flags.has("--version")) {
    process.stdout.write("0.1.0\n");
    process.exit(0);
  }

  const budget: Budget = {
    ...defaultBudget,
    maxWidth: value("--max-width") ?? defaultBudget.maxWidth,
    heavy: (value("--budget") ?? 200) * 1024,
    veryHeavy: (value("--budget") ?? 200) * 1024 * 3,
  };

  const collected = (await isFolder(target!)) ? await fromFolder(target!) : await fromUrl(target!);
  const report = buildReport(
    collected.source,
    collected.images.map((image) => analyze(image, budget)),
    collected.failed
  );

  if (flags.has("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    const color = !flags.has("--no-color") && process.stdout.isTTY && !process.env.NO_COLOR;
    process.stdout.write(formatReport(report, { color, top: value("--top") ?? 10 }));
  }

  const limit = value("--fail-over");
  process.exit(limit !== undefined && report.totalSaving > limit * 1024 ? 1 : 0);
}

function isValueOf(argv: string[], index: number): boolean {
  const previous = argv[index - 1];
  return ["--top", "--max-width", "--budget", "--fail-over"].includes(previous);
}

async function isFolder(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`${error instanceof CollectError ? error.message : `Unexpected error: ${error}`}\n`);
  process.exit(2);
});
