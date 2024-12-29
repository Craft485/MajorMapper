import { createHash } from 'node:crypto'

const HexDist2Black = (hex: string): number => Math.sqrt(hex.split('').map((v, i, a) => i % 2 === 0 ? Number("0x" + v + a[i + 1]) : undefined).reduce((acc, curr) => acc + (curr ? curr ** 2 : 0), 0))
const DarknessThreshold = 125 // Distance from pure black (0, 0, 0)
const LightnessThreshold = 350 // Also taken as distance from pure blank for simplicity

export function GenerateHexCodeFromCourseCode(courseCode: string): string {
    let i = 0
    const hash = createHash('md5').update(courseCode).digest('hex')
    let result = hash.substring(i, i + 6)
    let dist = HexDist2Black(result)
    while (LightnessThreshold < dist || dist < DarknessThreshold) {
        console.log(`Color for ${courseCode} was found to be too close to black or white (${result}). Retrying...`)
        if (i + 6 >= hash.length) break // If we somehow run out of hash and still haven't found a good enough color... just give up at this point
        result = hash.substring(++i, i + 6)
        dist = HexDist2Black(result)
    }
    return result
}