/**
 * This module holds functions that relate to using a genetic algorithm in order to better optimize the baseline degree plans
 */

import { Curriculum } from '../types/analytics'
import { DeepCopy, ShiftBranch, GetPreReqs, UpdateMovedCourses } from './utils'
import * as lodash from 'lodash'

const MAX_GENERATION_COUNT = 15, CHILDREN_PER_PARENT_PER_GENERATION = 5

export async function Optimize(curriculums: Curriculum[], currentGeneration: number = 1, hashedCurriculums: Set<string> = new Set): Promise<Curriculum> {
    if (currentGeneration > MAX_GENERATION_COUNT) {
        let bestScore = Score(curriculums[0]) , bestScoreIndex = 0
        for (let j = 1; j < curriculums.length; j++) {
            const currScore = Score(curriculums[j])
            if (bestScore > currScore) {
                bestScore = currScore
                bestScoreIndex = j
            }
        }
        console.log(`Found a best score of ${bestScore} out of ${curriculums.length} curriculums`)
        return curriculums[bestScoreIndex]
    }
    console.log(`[E/GA]: Starting generation ${currentGeneration} / ${MAX_GENERATION_COUNT}`)
    const nextGeneration = []
    for (let c = 0; c < curriculums.length; c++) {
        const curriculum = curriculums[c]
        const courses = curriculum.semesters.flat()
        const movedCourses: string[] = courses.filter(c => c.semesterLock?.length > 0 || c.semester === 1).map(c => c.courseCode)
        let singleCopyAllowedThrough = false
        for (let _ = 0; _ < CHILDREN_PER_PARENT_PER_GENERATION; _++) {
            let child = await Mutate(curriculum, movedCourses)
            if (lodash.isEqual(child, curriculum)) {
                if (singleCopyAllowedThrough) {
                    child = null
                    if (movedCourses.length === courses.length) {
                        break
                    }
                    continue
                }
                nextGeneration.push(child) // We have to add it here since the normal check for duplicates will prevent it from being added
                singleCopyAllowedThrough = true
            }
            const hashedChild = JSON.stringify(child)
            if (!hashedCurriculums.has(hashedChild)) {
                nextGeneration.push(child)
                hashedCurriculums.add(hashedChild)
            }
        }
        curriculums[c] = null
    }
    console.log(`[E/GA]: Found ${nextGeneration.length} viable mutations`)
    return await Optimize(nextGeneration, currentGeneration + 1, hashedCurriculums)
}

/**
 * Take a single step in optimization
 */
async function Mutate(curriculum: Curriculum, alreadyAttemptedMoves: string[]): Promise<Curriculum> {
    let tempCurriculum = DeepCopy<Curriculum>(curriculum)
    let courses = tempCurriculum.semesters.flat()
    while (alreadyAttemptedMoves.length < courses.length) {
        const availableCourses = courses.filter(x => !(alreadyAttemptedMoves.includes(x.courseCode)))
        let maxWeightedScoreIndex = 0
        let maxWeightedScore = availableCourses[0].semester * availableCourses[0].metrics.structuralComplexity
        for (let courseIndex = 1; courseIndex < availableCourses.length; courseIndex++) {
            const currScore = availableCourses[courseIndex].semester * availableCourses[courseIndex].metrics.structuralComplexity
            if (maxWeightedScore < currScore) {
                maxWeightedScore = currScore
                maxWeightedScoreIndex = courseIndex
            }
        }
        let courseToMove = availableCourses[maxWeightedScoreIndex]
        alreadyAttemptedMoves.push(courseToMove.courseCode)
        // console.log(`[Mutation]: Trying to move ${courseToMove.courseCode}`)
        const minSemesterIndex = (await GetPreReqs(tempCurriculum, courseToMove)).filter((v, i, a) => a.findIndex(v2 => v2.semester === v.semester) === i).length
        if (minSemesterIndex + 1 < courseToMove.semester) { // We can move the course to earlier in the semester
            const potentialSemesters = new Array(courseToMove.semester - (minSemesterIndex + 1)).fill(0).map((_, i) => minSemesterIndex + i)
            // console.log(`Potenial semester indicies: ${potentialSemesters.join(', ')}`)
            for (let s = 0; s < potentialSemesters.length; s++) {
                const firstLayerPreReqs = courses.filter(v => v.edges.includes(courseToMove.courseCode))
                courseToMove.semester = potentialSemesters[s] + 1
                for (const prereq of firstLayerPreReqs) {
                    ShiftBranch(prereq, courseToMove, tempCurriculum.semesters, false)
                }
                const creditHoursAfterShift = Object.values<number>(courses.reduce((acc, course) => { acc[course.semester] = (acc[course.semester] || 0) + course.credits; return acc }, {}))
                // Check for fail signal from shiftbranch and for credit hour violation
                if (Math.min(...courses.map(x => x.semester)) < 1 || creditHoursAfterShift.find(hours => hours > 18) !== undefined) {
                    // console.log(`[Mutation]: Couldn't move ${courseToMove.courseCode} to semester ${minSemesterIndex + 1}, retrying...`)
                    tempCurriculum = DeepCopy<Curriculum>(curriculum) // Reset temp
                    courses = tempCurriculum.semesters.flat()
                    courseToMove = courses.find(x => x.courseCode === courseToMove.courseCode)
                    continue
                }
                // console.log(`[Mutation]: Moved ${courseToMove.courseCode}`)
                await UpdateMovedCourses(tempCurriculum.semesters)
                return tempCurriculum
            }
        }
        // console.log(`[Mutation]: Couldn't move ${courseToMove.courseCode}, retrying...`)
    }
    return curriculum
}

/**
 * 
 * @param curriculum Full curriculum object
 * @returns Returns a number that represents both of the parameters of the CBCB model as a squared distance to the origin
 */
const Score = (curriculum: Curriculum): number => curriculum.semesters.flat().reduce((total, currCourse) => total + (currCourse.semester * currCourse.metrics.structuralComplexity), 0) //** 2 + Math.max(...new Array(curriculum.semesters.length).fill(0).map((_, i) => curriculum.semesters[i].reduce((total, curr) => total + curr.credits, 0))) ** 2

import { readFile } from 'fs/promises'
if (process.argv.find(s => s.includes('EGA'))) {
    readFile('out/server/buffer.json', { encoding: 'utf-8' })
    .then(async v => {
        const data = JSON.parse(v)
        Optimize([data])
        .then(async r => {
            console.log('done')
        })
    })
}