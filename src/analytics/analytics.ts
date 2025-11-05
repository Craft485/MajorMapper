import { GenerateHexCodeFromCourseCode } from '../utils/color'
import * as Analytics from '../types/analytics'
import { OptimizeCurriculum } from './optimize'
import { MergeCurricula } from './merge'
import { readFile, writeFile } from 'fs/promises'
import { CalculateMetrics } from './metrics'
import { Optimize as EGA } from './EGA'
import { Builder } from './Builder'

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
        await CalculateMetrics(curricula[0])
        await writeFile('./buffer.json', JSON.stringify(curricula[0]), { encoding: 'utf-8' })    
        return curricula[0]
    }
    const plan: Analytics.Curriculum = {
        semesters: [],
        structuralComplexity: 0,
        totalCredits: 0
    }
    console.log('Multiple curricula found')
    const mergedCurricula = await MergeCurricula(curricula)
    await CalculateMetrics(mergedCurricula)
    for (const course of Object.values(mergedCurricula)) { // Generate colors based on the unique course codes
        course.color = GenerateHexCodeFromCourseCode(course.courseCode)
    }
    await writeFile('./merged-buffer.json', JSON.stringify(mergedCurricula), { encoding: 'utf-8' })
    plan.semesters = await Builder(mergedCurricula)
    const optimizedDegreePlan = await OptimizeCurriculum(plan)
    await writeFile('./buffer.json', JSON.stringify(optimizedDegreePlan), { encoding: 'utf-8' })
    const finalDegreePlan: Analytics.Curriculum = await EGA([optimizedDegreePlan])
    await writeFile('./EGA-buffer.json', JSON.stringify(finalDegreePlan), { encoding: 'utf-8' })
    return finalDegreePlan
}
