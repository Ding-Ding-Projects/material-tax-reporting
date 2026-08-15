// Structural validation for a photo downloaded from the public dim-sum catalog
// before it is attached to a release.
//
// The release contract requires a real, downloadable dish photograph, so this
// validates the bytes rather than the file name. That distinction is not
// theoretical: this project has already shipped a 414-byte HTML "Access Denied"
// page sitting under a document extension, and an error page saved as
// `something.png` is indistinguishable from a photograph until somebody opens
// it. Every check below therefore reads the container itself.
//
// The container is walked end to end. Every PNG chunk CRC-32 is recomputed, and
// the stream must terminate exactly where the format says it should, so a
// truncated download, an error page, and a flipped byte all fail here rather
// than becoming a release asset that does not open.
//
// Only PNG and JPEG are accepted. The public catalog publishes PNG, and
// supporting exactly the formats that actually appear keeps both this validator
// and its PowerShell counterpart small enough to verify by hand. An unexpected
// format is reported as unsupported and fails soft, never silently attached.

const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MIN_IMAGE_BYTES = 64;
const MAX_DIMENSION = 20000;

const FORMATS_BY_EXTENSION = new Map([
  ["png", "png"],
  ["jpg", "jpeg"],
  ["jpeg", "jpeg"],
]);
const MEDIA_TYPES = new Map([
  ["png", "image/png"],
  ["jpeg", "image/jpeg"],
]);

export const SUPPORTED_IMAGE_EXTENSIONS = Object.freeze([...FORMATS_BY_EXTENSION.keys()]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_BIT_DEPTHS_BY_COLOUR_TYPE = new Map([
  [0, [1, 2, 4, 8, 16]],
  [2, [8, 16]],
  [3, [1, 2, 4, 8]],
  [4, [8, 16]],
  [6, [8, 16]],
]);
const JPEG_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(bytes, start, end) {
  let value = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    value = CRC_TABLE[(value ^ bytes[index]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

const readUint32 = (bytes, offset) =>
  ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
const readUint16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];

function assertDimensions(width, height) {
  if (width <= 0 || height <= 0) {
    throw new Error(`the image header declares a ${width}x${height} picture, which has no pixels`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(`the image header declares ${width}x${height}, beyond the ${MAX_DIMENSION}-pixel bound`);
  }
}

function validatePng(bytes) {
  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new Error("the payload does not begin with a PNG signature");
    }
  }

  let offset = PNG_SIGNATURE.length;
  let header = null;
  let imageDataChunks = 0;
  let sawEnd = false;

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) {
      throw new Error(`a PNG chunk header is truncated at byte ${offset}`);
    }
    const dataLength = readUint32(bytes, offset);
    if (dataLength > bytes.length - offset - 12) {
      throw new Error(
        `a PNG chunk at byte ${offset} declares ${dataLength} bytes, which runs past the end of a ${bytes.length}-byte payload`,
      );
    }
    const typeStart = offset + 4;
    const type = String.fromCharCode(bytes[typeStart], bytes[typeStart + 1], bytes[typeStart + 2], bytes[typeStart + 3]);
    if (!/^[A-Za-z]{4}$/.test(type)) {
      throw new Error(`a PNG chunk at byte ${offset} declares a non-alphabetic chunk type`);
    }
    if (sawEnd) {
      throw new Error(`the PNG stream carries a ${type} chunk after its IEND chunk`);
    }
    if (header === null && type !== "IHDR") {
      throw new Error(`the first PNG chunk is ${type} rather than IHDR`);
    }

    const dataStart = typeStart + 4;
    const dataEnd = dataStart + dataLength;
    const declaredCrc = readUint32(bytes, dataEnd);
    const actualCrc = crc32(bytes, typeStart, dataEnd);
    if (actualCrc !== declaredCrc) {
      throw new Error(`PNG chunk ${type} at byte ${offset} failed its CRC-32 check, so the payload is corrupt`);
    }

    if (type === "IHDR") {
      if (header !== null) throw new Error("the PNG stream carries more than one IHDR chunk");
      if (dataLength !== 13) throw new Error(`the PNG IHDR chunk carries ${dataLength} bytes rather than 13`);
      header = readPngHeader(bytes, dataStart);
    } else if (type === "IDAT") {
      imageDataChunks += 1;
    } else if (type === "IEND") {
      if (dataLength !== 0) throw new Error("the PNG IEND chunk is not empty");
      sawEnd = true;
    }

    offset = dataEnd + 4;
  }

  if (header === null) throw new Error("the PNG stream carries no IHDR chunk");
  if (imageDataChunks === 0) throw new Error("the PNG stream carries no IDAT image data");
  if (!sawEnd) throw new Error("the PNG stream ends without an IEND chunk, so the download is truncated");
  return header;
}

function readPngHeader(bytes, dataStart) {
  const width = readUint32(bytes, dataStart);
  const height = readUint32(bytes, dataStart + 4);
  const bitDepth = bytes[dataStart + 8];
  const colourType = bytes[dataStart + 9];
  const compression = bytes[dataStart + 10];
  const filter = bytes[dataStart + 11];
  const interlace = bytes[dataStart + 12];

  assertDimensions(width, height);
  const allowedDepths = PNG_BIT_DEPTHS_BY_COLOUR_TYPE.get(colourType);
  if (!allowedDepths) throw new Error(`the PNG header declares an unknown colour type ${colourType}`);
  if (!allowedDepths.includes(bitDepth)) {
    throw new Error(`the PNG header pairs colour type ${colourType} with an invalid bit depth ${bitDepth}`);
  }
  if (compression !== 0) throw new Error(`the PNG header declares an unknown compression method ${compression}`);
  if (filter !== 0) throw new Error(`the PNG header declares an unknown filter method ${filter}`);
  if (interlace !== 0 && interlace !== 1) throw new Error(`the PNG header declares an unknown interlace method ${interlace}`);
  return { width, height };
}

function validateJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("the payload does not begin with a JPEG start-of-image marker");
  }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new Error("the JPEG stream does not end with an end-of-image marker, so the download is truncated");
  }

  let offset = 2;
  let frame = null;

  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      throw new Error(`a JPEG marker was expected at byte ${offset}`);
    }
    let marker = bytes[offset + 1];
    offset += 2;
    while (marker === 0xff) {
      if (offset >= bytes.length) throw new Error("the JPEG stream ends inside a marker");
      marker = bytes[offset];
      offset += 1;
    }

    if (marker === 0xd8) throw new Error("the JPEG stream carries a second start-of-image marker");
    if (marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;

    if (offset + 2 > bytes.length) throw new Error(`the JPEG segment at byte ${offset} is truncated`);
    const segmentLength = readUint16(bytes, offset);
    if (segmentLength < 2) throw new Error(`the JPEG segment at byte ${offset} declares an impossible ${segmentLength}-byte length`);
    if (offset + segmentLength > bytes.length) {
      throw new Error(
        `the JPEG segment at byte ${offset} declares ${segmentLength} bytes, which runs past the end of a ${bytes.length}-byte payload`,
      );
    }

    if (JPEG_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 8) throw new Error(`the JPEG frame header at byte ${offset} is too short to carry dimensions`);
      const height = readUint16(bytes, offset + 3);
      const width = readUint16(bytes, offset + 5);
      assertDimensions(width, height);
      frame = { width, height };
    }

    // A start-of-scan segment is followed by entropy-coded data rather than by
    // another marker segment, so the marker walk stops here. The end-of-image
    // terminator was already asserted above, which is what proves the entropy
    // data actually arrived in full.
    if (marker === 0xda) {
      if (frame === null) throw new Error("the JPEG stream starts its scan before declaring a frame header");
      return frame;
    }

    offset += segmentLength;
  }

  if (frame === null) throw new Error("the JPEG stream declares no frame header");
  return frame;
}

/**
 * Validate downloaded bytes as the image format the supplied file name claims.
 *
 * Throws with an exact, non-leaking reason when the payload is not that image.
 * Returns the format, media type, intrinsic dimensions, and byte length when it
 * is.
 */
export function validateImageBytes(bytes, fileName) {
  if (!(bytes instanceof Uint8Array)) throw new Error("the payload is not a byte array");

  const name = String(fileName ?? "");
  const separator = name.lastIndexOf(".");
  const extension = separator > 0 ? name.slice(separator + 1).toLowerCase() : "";
  const format = FORMATS_BY_EXTENSION.get(extension);
  if (!format) {
    const supported = SUPPORTED_IMAGE_EXTENSIONS.join(", ");
    throw new Error(
      extension
        ? `.${extension} is not a supported release photo format; only ${supported} are attached`
        : `the catalog asset name carries no file extension, so its format cannot be checked`,
    );
  }

  if (bytes.byteLength < MIN_IMAGE_BYTES) {
    throw new Error(`the payload is ${bytes.byteLength} bytes, below the ${MIN_IMAGE_BYTES}-byte floor for a real image`);
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`the payload is ${bytes.byteLength} bytes, above the ${MAX_IMAGE_BYTES}-byte bound`);
  }

  const { width, height } = format === "png" ? validatePng(bytes) : validateJpeg(bytes);
  return { format, mediaType: MEDIA_TYPES.get(format), width, height, bytes: bytes.byteLength };
}

export const IMAGE_BOUNDS = Object.freeze({
  maxBytes: MAX_IMAGE_BYTES,
  minBytes: MIN_IMAGE_BYTES,
  maxDimension: MAX_DIMENSION,
});
