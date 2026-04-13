import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourcePath = path.join(rootDir, "docs", "business-plan", "strehe-prona-business-plan.md");
const outputPath = path.join(rootDir, "docs", "business-plan", "Strehe-Prona-Business-Plan.pdf");

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 56;
const contentWidth = pageWidth - margin * 2;
const titleColor = rgb(0.08, 0.19, 0.36);
const accentColor = rgb(0.18, 0.45, 0.42);
const textColor = rgb(0.1, 0.1, 0.1);
const mutedColor = rgb(0.4, 0.44, 0.5);

function wrapText(text, font, size, maxWidth) {
  const paragraphs = text.split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = "";

    for (const word of words) {
      const nextLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(nextLine, size);
      if (width <= maxWidth) {
        line = nextLine;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }

    if (line) lines.push(line);
  }

  return lines;
}

function parseMarkdown(markdown) {
  const rawLines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paragraph.join(" ").trim(),
      });
      paragraph = [];
    }
  };

  for (const line of rawLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (trimmed.startsWith("# ")) {
      flushParagraph();
      blocks.push({ type: "title", text: trimmed.slice(2).trim() });
      continue;
    }

    if (trimmed.startsWith("## ")) {
      flushParagraph();
      blocks.push({ type: "section", text: trimmed.slice(3).trim() });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      blocks.push({ type: "bullet", text: trimmed.slice(2).trim() });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

async function main() {
  const markdown = await fs.readFile(sourcePath, "utf8");
  const blocks = parseMarkdown(markdown);

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const addPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (requiredHeight) => {
    if (y - requiredHeight < margin) {
      addPage();
    }
  };

  const drawWrapped = (text, options) => {
    const {
      font,
      size,
      color,
      lineHeight,
      x = margin,
      maxWidth = contentWidth,
      bullet = false,
    } = options;

    const bulletIndent = bullet ? 14 : 0;
    const textX = bullet ? x + bulletIndent : x;
    const lines = wrapText(text, font, size, maxWidth - bulletIndent);
    const requiredHeight = Math.max(lines.length, 1) * lineHeight;

    ensureSpace(requiredHeight);

    if (bullet) {
      page.drawText("-", {
        x,
        y,
        size,
        font,
        color,
      });
    }

    for (const line of lines) {
      page.drawText(line, {
        x: textX,
        y,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
  };

  for (const block of blocks) {
    if (block.type === "title") {
      ensureSpace(70);
      page.drawText(block.text, {
        x: margin,
        y,
        size: 24,
        font: fontBold,
        color: titleColor,
      });
      y -= 18;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 1.5,
        color: accentColor,
      });
      y -= 28;
      continue;
    }

    if (block.type === "section") {
      ensureSpace(32);
      y -= 6;
      page.drawText(block.text, {
        x: margin,
        y,
        size: 14,
        font: fontBold,
        color: accentColor,
      });
      y -= 22;
      continue;
    }

    if (block.type === "bullet") {
      drawWrapped(block.text, {
        font: fontRegular,
        size: 10.5,
        color: textColor,
        lineHeight: 14,
        bullet: true,
      });
      y -= 2;
      continue;
    }

    drawWrapped(block.text, {
      font: fontRegular,
      size: 10.5,
      color: textColor,
      lineHeight: 14,
    });
    y -= 8;
  }

  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`Strehe-Prona Business Plan | Page ${index + 1}`, {
      x: margin,
      y: 26,
      size: 9,
      font: fontRegular,
      color: mutedColor,
    });
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(outputPath, pdfBytes);
  console.log(`Generated PDF: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
