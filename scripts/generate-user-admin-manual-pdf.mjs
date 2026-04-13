import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const sourcePath = path.join(
  rootDir,
  "docs",
  "manuals",
  "strehe-prona-user-admin-manual.md",
);
const outputPath = path.join(
  rootDir,
  "docs",
  "manuals",
  "Strehe-Prona-User-Admin-Manual.pdf",
);

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 42;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const COLORS = {
  ink: rgb(0.1, 0.11, 0.14),
  muted: rgb(0.43, 0.47, 0.52),
  border: rgb(0.85, 0.88, 0.91),
  brand: rgb(0.08, 0.24, 0.42),
  brandSoft: rgb(0.94, 0.97, 1),
  soft: rgb(0.97, 0.98, 0.99),
  white: rgb(1, 1, 1),
};

function cleanInlineMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function wrapText(text, font, size, maxWidth) {
  const paragraphs = String(text).split("\n");
  const lines = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();

    if (!trimmed) {
      lines.push("");
      continue;
    }

    const words = trimmed.split(/\s+/);
    let current = "";

    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }

    if (current) lines.push(current);
  }

  return lines.length ? lines : [""];
}

function parseMarkdown(markdown) {
  const rawLines = markdown.split(/\r?\n/);
  const blocks = [];
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({
      type: "paragraph",
      text: cleanInlineMarkdown(paragraph.join(" ").trim()),
    });
    paragraph = [];
  };

  for (const line of rawLines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    const imageMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)$/);
    if (imageMatch) {
      flushParagraph();
      blocks.push({
        type: "image",
        alt: imageMatch[1].trim(),
        src: imageMatch[2].trim(),
      });
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      flushParagraph();
      blocks.push({ type: "divider" });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: cleanInlineMarkdown(headingMatch[2]),
      });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      flushParagraph();
      blocks.push({
        type: "bullet",
        text: cleanInlineMarkdown(trimmed.slice(2)),
      });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}

async function loadImage(pdfDoc, imagePath) {
  const bytes = await fs.readFile(imagePath);
  const extension = path.extname(imagePath).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") {
    return pdfDoc.embedJpg(bytes);
  }

  return pdfDoc.embedPng(bytes);
}

async function main() {
  const markdown = await fs.readFile(sourcePath, "utf8");
  const blocks = parseMarkdown(markdown);

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const newPage = () => {
    page = pdfDoc.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  const ensureSpace = (height) => {
    if (y - height < MARGIN) {
      newPage();
    }
  };

  const drawTextBlock = (text, options = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10.5;
    const color = options.color ?? COLORS.ink;
    const x = options.x ?? MARGIN;
    const maxWidth = options.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = options.lineHeight ?? size + 3.4;
    const lines = wrapText(text, font, size, maxWidth);
    const requiredHeight = Math.max(lines.length, 1) * lineHeight;

    ensureSpace(requiredHeight);

    for (const line of lines) {
      page.drawText(line, {
        x,
        y,
        size,
        font,
        color,
      });
      y -= lineHeight;
    }
  };

  for (const block of blocks) {
    if (block.type === "heading") {
      const headingStyles = {
        1: { size: 22, color: COLORS.brand, spacingTop: 4, spacingBottom: 16 },
        2: { size: 16, color: COLORS.brand, spacingTop: 10, spacingBottom: 10 },
        3: { size: 13, color: COLORS.ink, spacingTop: 8, spacingBottom: 8 },
        4: { size: 11.5, color: COLORS.ink, spacingTop: 6, spacingBottom: 6 },
      };

      const style = headingStyles[block.level] ?? headingStyles[4];
      y -= style.spacingTop;
      drawTextBlock(block.text, {
        font: bold,
        size: style.size,
        color: style.color,
        lineHeight: style.size + 4,
      });
      y -= style.spacingBottom;

      if (block.level === 1) {
        ensureSpace(14);
        page.drawLine({
          start: { x: MARGIN, y: y + 6 },
          end: { x: PAGE.width - MARGIN, y: y + 6 },
          thickness: 1.2,
          color: COLORS.border,
        });
        y -= 8;
      }

      continue;
    }

    if (block.type === "paragraph") {
      drawTextBlock(block.text, {
        size: 10.5,
        lineHeight: 14,
      });
      y -= 8;
      continue;
    }

    if (block.type === "bullet") {
      const bulletX = MARGIN;
      const textX = MARGIN + 12;
      const size = 10.2;
      const lineHeight = 13.5;
      const lines = wrapText(block.text, regular, size, CONTENT_WIDTH - 12);
      ensureSpace(lines.length * lineHeight + 2);

      page.drawText("-", {
        x: bulletX,
        y,
        size,
        font: bold,
        color: COLORS.brand,
      });

      for (const line of lines) {
        page.drawText(line, {
          x: textX,
          y,
          size,
          font: regular,
          color: COLORS.ink,
        });
        y -= lineHeight;
      }

      y -= 2;
      continue;
    }

    if (block.type === "divider") {
      ensureSpace(16);
      y -= 4;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE.width - MARGIN, y },
        thickness: 1,
        color: COLORS.border,
      });
      y -= 12;
      continue;
    }

    if (block.type === "image") {
      const imagePath = path.resolve(path.dirname(sourcePath), block.src);

      try {
        const image = await loadImage(pdfDoc, imagePath);
        const imageMaxWidth = CONTENT_WIDTH;
        const imageMaxHeight = 320;
        const widthRatio = imageMaxWidth / image.width;
        const heightRatio = imageMaxHeight / image.height;
        const scale = Math.min(widthRatio, heightRatio, 1);
        const width = image.width * scale;
        const height = image.height * scale;

        ensureSpace(height + 30);

        const boxX = MARGIN;
        const boxY = y - height - 8;

        page.drawRectangle({
          x: boxX - 6,
          y: boxY - 6,
          width: width + 12,
          height: height + 12,
          color: COLORS.white,
          borderColor: COLORS.border,
          borderWidth: 1,
        });

        page.drawImage(image, {
          x: boxX,
          y: boxY,
          width,
          height,
        });

        y = boxY - 16;

        const caption = block.alt || path.basename(block.src);
        drawTextBlock(caption, {
          size: 9,
          color: COLORS.muted,
          lineHeight: 12,
        });
        y -= 8;
      } catch {
        drawTextBlock(
          `Missing image: ${block.src}`,
          { size: 9.5, color: COLORS.muted, lineHeight: 12.5 },
        );
        y -= 8;
      }

      continue;
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((pdfPage, index) => {
    pdfPage.drawText(`STREHË Prona User & Admin Manual | Page ${index + 1}`, {
      x: MARGIN,
      y: 22,
      size: 8.5,
      font: regular,
      color: COLORS.muted,
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
