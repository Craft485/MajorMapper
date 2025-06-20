import { Curriculum, Vertex } from '../types/analytics'

// NOTE: I'm worried that this could lead to bugs where a course is in the path of multiple duplicates (or is itself a duplicate) and ends up being moved somewhere it shouldn't
export async function ShiftBranch(currentVertex: Vertex, previousVertex: Vertex, semesters: Vertex[][], shiftingForward = true): Promise<void> {
    // console.log(`Shifting ${currentVertex.courseCode} in semester ${currentVertex.semester} according to ${previousVertex.courseCode} in ${previousVertex.semester} | Is a forward shift: ${shiftingForward}`)
    if (currentVertex.semesterLock?.length || previousVertex.semesterLock?.length) { // Check for locks
        // console.log(`${currentVertex.courseCode} is locked to semester(s) ${currentVertex.semesterLock.join(',')}`)
        currentVertex.semester = -1 // This will act as a fail signal
        return
    }
    if (previousVertex.edges.includes(currentVertex.courseCode) && currentVertex.edges.includes(previousVertex.courseCode)) {
        // Co-req
        // console.log(`${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}`)
        currentVertex.semester = previousVertex.semester
        // console.log(`Since ${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}, it was shifted to semester ${currentVertex.semester}`)
        return 
    }
    const currentEdges: string[] = currentVertex.edges
    const currentSemester = currentVertex.semester
    const previousSemester = previousVertex.semester
    const courses = semesters.flat()
    const dependencies: Vertex[] = courses.filter(v => shiftingForward ? currentEdges.includes(v.courseCode) : v.edges.includes(currentVertex.courseCode))
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
    return c1.edges.includes(c2.courseCode) && c2.edges.includes(c1.courseCode)
}

export async function calculateCoursePath(course: Vertex, curriculum: Curriculum, foundNodes: Vertex[] = [], isLookingForward?: boolean): Promise<Vertex[]> {
    const path: Vertex[] = [
        // Look forward one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === true 
            ? curriculum.semesters.flat().filter(vertex => course.edges.includes(vertex.courseCode))
            : []
        ),
        // Look backwards one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === false 
            ? curriculum.semesters.flat().filter(vertex => vertex.edges.includes(course.courseCode))
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
                                    ? node.edges.find(edge => edge === course.courseCode) === undefined 
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

export async function GetPreReqs(curriculum: Curriculum, course: Vertex): Promise<Vertex[]> {
    return (await calculateCoursePath(course, curriculum, [], false)).filter(v => v.semester < course.semester)
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