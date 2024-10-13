import { createHash } from 'node:crypto'

export function GenerateHexCodeFromCourseCode(courseCode: string): string {
    return createHash('md5').update(courseCode).digest('hex').substring(0, 6)
}