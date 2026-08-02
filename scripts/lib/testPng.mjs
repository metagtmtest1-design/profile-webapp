/**
 * Builds a real PNG of arbitrary size for upload tests.
 *
 * The verification scripts used to share one 8x8 base64 blob. That is smaller than any
 * slot on the site renders at, and uploading it left a solid colour block stretched
 * across the hero — which is exactly what a UI/UX round found on the live page. Now that
 * the uploader refuses undersized images, the fixtures have to be plausible too.
 */
import { deflateSync } from 'node:zlib'

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/**
 * An RGB PNG with a soft diagonal gradient — visually obvious in a screenshot as a real
 * image rather than a flat fill, so a reviewer can tell an upload from a rendering bug.
 */
export function makePng(width = 1200, height = 900) {
  const raw = Buffer.alloc(height * (1 + width * 3))
  let p = 0
  for (let y = 0; y < height; y++) {
    raw[p++] = 0 // filter type: none
    for (let x = 0; x < width; x++) {
      raw[p++] = Math.round((x / width) * 200) + 30
      raw[p++] = Math.round((y / height) * 160) + 60
      raw[p++] = 180
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Big enough for the hero slot, which requires 640px. */
export const HERO_PNG = makePng(1200, 900)
/** Big enough for a service card, which requires 320px. */
export const CARD_PNG = makePng(800, 600)
