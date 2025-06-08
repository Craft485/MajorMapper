import { Curriculum, Vertex } from '../types/analytics'
import { CalculateCreditHours, DeepCopy, FindCoreqs, GetPreReqs, UpdateRelativeSemesterLocks } from './utils'

export async function Builder(curriculum: Curriculum): Promise<Vertex[][]> {
    const semesters: Vertex[][] = new Array(curriculum.semesters.length).fill(0).map(_ => new Array)
    const coursesWithLocks: Vertex[] = []
    // Copy the courses from the passed in curriculum, splitting them into different arrays depending if they have semester locks or not
    // then sort the non-semester locked courses based on their course number
    const courses = DeepCopy<Vertex[]>(curriculum.semesters.flat()).filter(course => {
        if (course.semesterLock?.length > 0) {
            coursesWithLocks.push(DeepCopy<Vertex>(course))
            return false
        }
        return true
    }).sort((c1, c2) => +/(\d+)/.exec(c1.courseCode)[0] - +/(\d+)/.exec(c2.courseCode)[0])
    // Add locked courses first, including any coreqs attached to them
    for (const lockedCourse of coursesWithLocks) {
        if (semesters.flat().find(v => v.courseCode === lockedCourse.courseCode) === undefined) {
            const coreqs = await FindCoreqs([...courses, ...coursesWithLocks], lockedCourse)
            const group = [lockedCourse, ...coreqs]
            const groupSemesterIndex = Math.min(...lockedCourse.semesterLock)
            group.forEach(c => c.semester = groupSemesterIndex < 0 ? semesters.length + (groupSemesterIndex + 1) : groupSemesterIndex + 1)
            semesters.at(groupSemesterIndex).push(...group)
            for (const coreq of coreqs) {
                const coreqIndex = courses.findIndex(c => c.courseCode === coreq.courseCode)
                if (coreqIndex >= 0) {
                    courses.splice(coreqIndex, 1)
                }
            }
        }
    }
    while (courses.length > 0) {
        const course = courses[0]
        const creditHours = CalculateCreditHours(semesters)
        const prereqs = await GetPreReqs(curriculum, course)
        const minSemesterIndex = prereqs.length ? Math.max(...prereqs.map(c => c.semester)) : 0
        // Find any coreqs relating to the current course
        const coreqs = await FindCoreqs(courses, course)
        const currentCourseGroup = [course, ...coreqs].map(DeepCopy)
        const totalCreditSumForCurrentGroup = currentCourseGroup.reduce((total, currCourse) => total + currCourse.credits, 0)
        // Find the first semester that can accomodate the current course and its coreqs
        const semesterIndex = semesters.findIndex((_, sIndex) => sIndex >= minSemesterIndex && (creditHours[sIndex] + totalCreditSumForCurrentGroup) <= 18)
        if (semesterIndex === -1) {
            // Couldn't accommodate the current group, add an additional semester
            console.log(`Could not accommodate ${course.courseCode} in the current layout, adding an additional semester`)
            semesters.push(currentCourseGroup)
            currentCourseGroup.forEach(c => c.semester = semesters.length)
            await UpdateRelativeSemesterLocks(semesters)
        } else {
            currentCourseGroup.forEach(c => c.semester = semesterIndex + 1)
            semesters[semesterIndex].push(...currentCourseGroup)
        }
        // Remove current group from courses list
        for (const vertex of currentCourseGroup) {
            const vertexIndex = courses.findIndex(v => v.courseCode === vertex.courseCode)
            courses.splice(vertexIndex, 1)
        }
    }

    return semesters
}

import { readFile } from 'fs/promises'
if (process.argv.find(s => s.includes('Builder'))) {
    readFile('out/server/merged-buffer.json', { encoding: 'utf-8' })
    .then(async v => {
        const data = JSON.parse(v)
        Builder(data)
        .then(async r => {
            console.log('done')
        })
    })
}