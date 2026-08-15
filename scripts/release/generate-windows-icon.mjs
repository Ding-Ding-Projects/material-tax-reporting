import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pngToIco from "png-to-ico";
import sharp from "sharp";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const sourcePath = path.join(repositoryRoot, "assets", "brand", "material-tax-reporting-mark.png");
const outputDirectory = path.join(repositoryRoot, "apps", "desktop", "build");
const outputPath = path.join(outputDirectory, "icon.ico");
const temporaryDirectory = path.join(outputDirectory, `.icon-${process.pid}-${Date.now()}`);
const temporaryOutput = `${outputPath}.tmp`;
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  throw new Error(`Windows icon generation failed: ${message}`);
}

function verifyIco(buffer) {
  if (buffer.length < 6 || buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) {
    fail("the generated file does not have a valid ICO header");
  }
  const count = buffer.readUInt16LE(4);
  if (count !== sizes.length || buffer.length < 6 + count * 16) {
    fail(`expected ${sizes.length} image entries, received ${count}`);
  }
  const actualSizes = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = buffer[entryOffset] || 256;
    const height = buffer[entryOffset + 1] || 256;
    const byteLength = buffer.readUInt32LE(entryOffset + 8);
    const imageOffset = buffer.readUInt32LE(entryOffset + 12);
    if (width !== height || byteLength <= 0 || imageOffset < 6 + count * 16 || imageOffset + byteLength > buffer.length) {
      fail(`ICO entry ${index + 1} has invalid dimensions or byte bounds`);
    }
    actualSizes.push(width);
  }
  actualSizes.sort((left, right) => left - right);
  if (actualSizes.join(",") !== sizes.join(",")) {
    fail(`ICO size table is ${actualSizes.join(",")}; expected ${sizes.join(",")}`);
  }
}

const sourceInfo = await stat(sourcePath).catch(() => null);
if (!sourceInfo?.isFile() || sourceInfo.size <= 0 || sourceInfo.size > 10 * 1024 * 1024) {
  fail("assets/brand/material-tax-reporting-mark.png is missing, empty, or larger than 10 MiB");
}
const sourceBytes = await readFile(sourcePath);
if (!sourceBytes.subarray(0, pngSignature.length).equals(pngSignature)) {
  fail("the brand source does not contain a PNG byte signature");
}
const metadata = await sharp(sourceBytes, { limitInputPixels: 8192 * 8192 }).metadata();
if (metadata.format !== "png" || metadata.pages !== undefined && metadata.pages !== 1) {
  fail("the brand source must be one non-animated PNG image");
}
if (!metadata.width || !metadata.height || metadata.width < 256 || metadata.height < 256 || metadata.width > 8192 || metadata.height > 8192) {
  fail("the brand source dimensions must be between 256 and 8192 pixels on each axis");
}

await mkdir(temporaryDirectory, { recursive: true });
try {
  const resizedPaths = [];
  for (const size of sizes) {
    const resizedPath = path.join(temporaryDirectory, `icon-${size}.png`);
    await sharp(sourceBytes, { limitInputPixels: 8192 * 8192 })
      .resize(size, size, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
        kernel: sharp.kernel.lanczos3,
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(resizedPath);
    const resizedMetadata = await sharp(resizedPath).metadata();
    if (resizedMetadata.width !== size || resizedMetadata.height !== size || resizedMetadata.format !== "png") {
      fail(`the ${size}x${size} PNG derivative did not round-trip at the requested size`);
    }
    resizedPaths.push(resizedPath);
  }

  const ico = await pngToIco(resizedPaths);
  verifyIco(ico);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(temporaryOutput, ico);
  const roundTrip = await readFile(temporaryOutput);
  verifyIco(roundTrip);
  await rename(temporaryOutput, outputPath);
  process.stdout.write(`Generated ${outputPath} with sizes ${sizes.join(", ")} pixels.\n`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
  await rm(temporaryOutput, { force: true });
}

