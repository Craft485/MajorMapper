import { createHash } from 'node:crypto'
import { Curriculum, Vertex, VertexMap } from '../types/analytics'

// NOTE: I'm worried that this could lead to bugs where a course is in the path of multiple duplicates (or is itself a duplicate) and ends up being moved somewhere it shouldn't
export async function ShiftBranch(currentVertex: Vertex, previousVertex: Vertex, semesters: Vertex[][], shiftingForward = true): Promise<void> {
    // console.log(`Shifting ${currentVertex.courseCode} in semester ${currentVertex.semester} according to ${previousVertex.courseCode} in ${previousVertex.semester} | Is a forward shift: ${shiftingForward}`)
    if (currentVertex.semesterLock?.length || previousVertex.semesterLock?.length) { // Check for locks
        // console.log(`${currentVertex.courseCode} is locked to semester(s) ${currentVertex.semesterLock.join(',')}`)
        currentVertex.semester = -1 // This will act as a fail signal
        return
    }

    if (AreCoReqs(currentVertex, previousVertex)) {
        // Co-req
        // console.log(`${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}`)
        currentVertex.semester = previousVertex.semester
        // console.log(`Since ${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}, it was shifted to semester ${currentVertex.semester}`)
        return 
    }

    const currentSemester = currentVertex.semester
    const previousSemester = previousVertex.semester
    const courses = semesters.flat()
    const dependencies: Vertex[] = ComputeVerticesFromCourseCodes(semesters.flat(), shiftingForward ? currentVertex.postReqs : currentVertex.preReqs)
    // Move courses that are not in the correct semester
    if (currentSemester <= previousSemester && shiftingForward) { // Forward
        currentVertex.semester = previousSemester + 1
    } else if (currentSemester >= previousSemester && !shiftingForward) { // Backward
        currentVertex.semester = previousSemester - 1
    }
    // console.log(`Shifted ${currentVertex.courseCode} to semester ${currentVertex.semester}`)
    for (const node of dependencies) {
        // console.log(JSON.stringify(currentVertex))
        // console.log(JSON.stringify(node))
        if (currentSemester !== currentVertex.semester) {
            await ShiftBranch(node, currentVertex, semesters, shiftingForward)
        }
    }
}

export function AreCoReqs(c1: Vertex, c2: Vertex): boolean {
    return c1.coReqs.includes(c2.courseCode)
}

export async function calculateCoursePath(course: Vertex, curriculum: Curriculum | VertexMap, foundNodes: Vertex[] = [], isLookingForward?: boolean): Promise<Vertex[]> {
    // console.log(curriculum)
    const path: Vertex[] = [
        // Look forward one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === true 
            ? ComputeVerticesFromCourseCodes(curriculum.totalCredits !== undefined 
                ? (curriculum.semesters as Vertex[][]).flat() 
                : Object.values(curriculum as VertexMap), course.postReqs)
            : []
        ),
        // Look backwards one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === false 
            ? ComputeVerticesFromCourseCodes(curriculum.totalCredits !== undefined 
                ? (curriculum.semesters as Vertex[][]).flat() 
                : Object.values(curriculum as VertexMap), course.preReqs)
            : []
        )
    ]

    if (isLookingForward === undefined) path.push(course)

    for (const node of path) {
        if (foundNodes.map(n => n.courseCode).includes(node.courseCode)) continue
        foundNodes.push(node)
        await calculateCoursePath(node, 
                                  curriculum, 
                                  foundNodes, 
                                  AreCoReqs(course, node) 
                                  ? isLookingForward
                                  : (isLookingForward === undefined 
                                    ? node.postReqs.includes(course.courseCode) === undefined 
                                    : isLookingForward)
        )
    }

    return foundNodes
}

export function DeepCopy<Type>(obj: Type): Type {
    return JSON.parse(JSON.stringify(obj))
}

export function CalculateCreditHours(semesters: Vertex[][], credits?: number[]): number[] {
    if (!credits) credits = []
    credits.length = 0
    credits.push(...semesters.map(s => s.reduce((total, course) => total + course.credits, 0)))
    return credits
}

export async function UpdateRelativeSemesterLocks(semesters: Vertex[][]): Promise<void> {
    // Check for any relative locks and (force?) update them
    const temp = DeepCopy<Vertex[][]>(semesters)
    let relativeLocksWereUpdated = false
    for (let i = 0; i < temp.length; i++) {
        const tempSemester = DeepCopy<Vertex[]>(temp[i])
        for (const course of tempSemester) {
            const relativeLock = course.semesterLock?.find(lock => lock < 0) || undefined
            if (relativeLock !== undefined) { // If the course has at least one relative semester lock
                relativeLocksWereUpdated = true
                // Remove old vertex
                const oldSemesterIndex = temp.findIndex(sem => sem.find(v => v.courseCode === course.courseCode))
                const oldVertexIndex = temp[oldSemesterIndex].findIndex(vertex => vertex.courseCode === course.courseCode)
                console.log(`Old semester: ${oldSemesterIndex + 1} | New Semester ${course.semester} | For course ${course.courseCode} | Due to a relative lock being found after an additional semester was added`)
                temp[oldSemesterIndex].splice(oldVertexIndex, 1)
                // Update the semester prop on the course (relativeLock is an index, so we need to offset by +1)
                course.semester = relativeLock + semesters.length + 1
                // Add new vertex
                temp.at(relativeLock).push(course)
            }
        }
    }   
    if (relativeLocksWereUpdated) {
        semesters.length = 0
        semesters.push(...temp)
    }
}

/**
 * Routine to scan a curriculum for courses that need to be moved to another semester, then moves them
 * @param semesterData 2D array of course data
 * @param replaceEarliestOccurance If true, use Array#findIndex, otherwise use Array#findLastIndex. Defaults to true
 * 
 * @returns {Promise<void>}
 */
export async function UpdateMovedCourses(semesterData: Vertex[][], replaceEarliestOccurance: Boolean = true): Promise<void> {
    const semesters = DeepCopy<Vertex[][]>(semesterData)
    for (let i = 0; i < semesterData.length; i++) {
        const semester = DeepCopy<Vertex[]>(semesters[i])
        for (const course of semester) {
            if (course.semester - 1 !== i) {
                // Remove old vertex    
                const oldSemesterIndex = semesters[replaceEarliestOccurance ? "findIndex" : "findLastIndex"](sem => sem.find(v => v.courseCode === course.courseCode))
                const oldVertexIndex = semesters[oldSemesterIndex].findIndex(vertex => vertex.courseCode === course.courseCode)
                semesters[oldSemesterIndex].splice(oldVertexIndex, 1)
                // Add an extra semester if we need to
                if (course.semester > semesters.length) {
                    semesters.push([])
                    await UpdateRelativeSemesterLocks(semesters)
                }
                // Add the new vertex
                semesters[course.semester - 1].push(course)
                // console.log(`Old Semester: ${oldSemesterIndex + 1} | New Semester: ${course.semester} | For Course: ${course.courseCode}`)
            }
        }
    }
    semesterData.length = 0
    semesterData.push(...semesters)
}

export async function GetPreReqs(curriculum: Vertex[], course: Vertex): Promise<Vertex[]> {
    // Remove any courses that we know can't be prereqs
    const prereqCandidates = curriculum.filter(v => v.semester <= course.semester)
    // Convery from array to object
    const prereqCandidatesLookup = {}
    for (const v of curriculum) prereqCandidates[v.courseCode] = v
    // Get the partial course path
    return await calculateCoursePath(course, prereqCandidatesLookup, [], false)
}

export async function FindCoreqs(courses: readonly Vertex[], course: Vertex, coreqs: Vertex[] = [], isTop = true): Promise<Vertex[]> {
    if (coreqs.length === 0) coreqs.push(course)
    const coreqsFromCurrCourse = courses.filter(c => AreCoReqs(c, course) && coreqs.find(v => v.courseCode === c.courseCode) === undefined)
    for (const coreq of coreqsFromCurrCourse) {
        if (!coreqs.find(v => v.courseCode === coreq.courseCode)) {
            coreqs.push(coreq)
            FindCoreqs(courses, coreq, coreqs, false)
        }
    }
    if (isTop) coreqs.shift()
    return coreqs
}

export function CharSum(str: string): number {
    return createHash('md5').update(str).digest('hex').split('').reduce((acc, curr) => acc + curr.charCodeAt(0), 0)
}

function GroupStrings(list: string[], predicate: (str: string) => number): string[][] {
    const result = [ [ list[0] ] ]
    let lastGroup = result[0]
    let lastGroupScore = predicate(lastGroup[0])
    for (let i = 1; i < list.length; i++) {
        const str = list[i]
        if (predicate(str) === lastGroupScore) {
            lastGroup.push(str)
        } else {
            result.push([str])
            lastGroup = result.at(-1)
            lastGroupScore = predicate(lastGroup[0])
        }
    }
    return result
}

export function SortStrings(list: string[]): string[] {
    // Phase 1, sort then group by number
    list.sort((a, b) => +/(\d+)/.exec(a)[0] - +/(\d+)/.exec(b)[0])
    console.log('Phase 1.1: ', list)
    const numberGrouping = GroupStrings(list, s => +/(\d+)/.exec(s)[0])
    console.log('Phase 1.2: ', numberGrouping)
    
    // Phase 2, sort then group by length
    numberGrouping.map(group => group.sort((a, b) => a.length - b.length))
    console.log('Phase 2.1: ', numberGrouping)
    const charSumGrouping = numberGrouping.map(group => GroupStrings(group, s => s.length))
    console.log('Phase 2.2: ', charSumGrouping)
    
    // Phase 3, sort by charsum
    charSumGrouping.map(group => group.map(subgroup => subgroup.sort((a, b) => CharSum(a) - CharSum(b))))
    console.log('Phase 3.1: ', charSumGrouping)
    
    return charSumGrouping.flat(2)
}

export function SortVertices(list: Vertex[]): Vertex[] {
    // Sort a given list of courses based on their course code
    const courseCodeList = list.map(course => course.courseCode)
    const sortedCourseCodeList = SortStrings(courseCodeList)
    const result = []
    for (const code of sortedCourseCodeList) { // There may be a more efficient way of doing this
        result.push(list.find(v => v.courseCode === code))
    }
    return result
}

export function ComputeVerticesFromCourseCodes(courses: Vertex[], courseCodes: string[]): Vertex[] {
    return courses.filter(course => courseCodes.includes(course.courseCode))
}
