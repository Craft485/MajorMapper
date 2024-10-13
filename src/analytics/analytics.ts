import { GenerateHexCodeFromCourseCode } from '../utils/color'
import * as Analytics from '../types/analytics'
import { OptimizeCurriculum } from './optimize'
//import { CalculateMetrics } from './metrics'
import { MergeCurricula } from './merge'
import { readFile } from 'fs/promises'

export async function ParseAnalytics(programStacks: string[]): Promise<Analytics.Curriculum> {
    console.log(`Client requests the following stacks: ${programStacks.join(', ')}`)
    const curricula: Analytics.Curriculum[] = []
    // Load the curriculum data
    for await (const programStack of programStacks) {
        const fileContents = await readFile(`../../json/${programStack}.json`, 'utf-8').catch(err => { if (err) throw err })
        curricula.push(JSON.parse(fileContents as string).data)
        console.log(`Found ${programStack}`)
    }
    // Return early if needed
    if (curricula.length === 1) {
        for (const course of curricula[0].semesters.flat()) {
            course.color = GenerateHexCodeFromCourseCode(course.courseCode)
        }
        return curricula[0]
    }
    console.log('Multiple curricula found')
    const mergedCurricula = await MergeCurricula(curricula)
    for (const course of mergedCurricula.semesters.flat()) {
        course.color = GenerateHexCodeFromCourseCode(course.courseCode)
    }
    const optimizedDegreePlan = await OptimizeCurriculum(mergedCurricula)

    return optimizedDegreePlan
}
