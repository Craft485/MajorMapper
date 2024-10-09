import { readFile } from 'fs/promises'
import * as Analytics from '../types/analytics'

// TODO: Calculate metrics for the curricula
export async function ParseAnalytics(programStacks: string[]): Promise<Analytics.Curriculum> {
    const curricula: Analytics.Curriculum[] = []
    // Load the curriculum data
    for await (const programStack of programStacks) {
        const fileContents = await readFile(`../../json/${programStack}.json`, 'utf-8').catch(err => { if (err) throw err })
        curricula.push(JSON.parse(fileContents as string).data)
    }
    // Return early if needed
    if (curricula.length === 1) return curricula[0]

    const mergedCurricula = await MergeCurricula(curricula)
    const optimizedDegreePlan = await OptimizeCurriculum(mergedCurricula)

    return optimizedDegreePlan
}

/**
Identify common courses
For each common course, merge their edges/post-reqs
calculate paths for the course in each curriculum is appears in
use the semester spacing in each path to determine where the duplicate course should be placed for merging
*/
async function MergeCurricula(curricula: Analytics.Curriculum[]): Promise<Analytics.Curriculum> {
    const mergedCurriculum: Analytics.Curriculum = {
        semesters: new Array(Math.max(...curricula.flatMap(c => c.semesters.map(a => a.length)))).fill(null).map(x => []),
        totalCredits: curricula.reduce((a, b) => a + b.totalCredits, 0)
    }
    // Create object reference/pointer to the semesters as a shorthand
    const mergedSemesters: Analytics.Vertex[][] = mergedCurriculum.semesters
    
    const courseListSets: Array<Set<string>> = []

    // For each curriculum, create a Set of all classes course codes
    for (const curriculum of curricula) {
        const allCourses = curriculum.semesters.flat()
        for (const course of allCourses) {
            mergedSemesters[course.semester - 1].push(course)
        }
        courseListSets.push(new Set(...allCourses.map(course => course.courseCode)))
    }

    // Determine what course codes are shared accross two or more curriculums
    let duplicateCourseCodesSet: Set<string> = new Set()
    for (let i = 0; i < courseListSets.length; i++) {
        for (let j = 0; j < courseListSets.length; j++) {
            if (i === j) continue
            
            const intersection = courseListSets[i].intersection(courseListSets[j])
            
            if (intersection.size > 0) duplicateCourseCodesSet = duplicateCourseCodesSet.union(intersection)
        }
    }

    // For each course that occurs more than once, calcuate its path in all curricula is appears in and determine what semester it needs to be placed in (for now)
    for (const courseCode of duplicateCourseCodesSet) {
        const paths: Analytics.Vertex[][] = []
        let mergedVertex: Analytics.Vertex | null = null
        // Grab verticies and curricula for the course code
        const familiarCurricula = curricula.filter(curriculum => curriculum.semesters.flat().map(vertex => vertex.courseCode).includes(courseCode))
        for (const currentCurriculum of familiarCurricula) {
            // Calculate path for each vertex
            const vertex: Analytics.Vertex = currentCurriculum.semesters.flat().find(vertex => vertex.courseCode === courseCode)
            const path = await calculateCoursePath(vertex, currentCurriculum)
            if (!mergedVertex) {
                mergedVertex = { ...vertex }
            } else {
                mergedVertex.edges = [...mergedVertex.edges, ...vertex.edges].filter((edge, i, arr) => arr.findIndex(edge2 => edge.courseCode === edge2.courseCode) === i)
            }
            paths.push(path)
        }
        // Determine semester spacing for placing the merged vertex
        /**
         * Indetify the absolute min and max semesters the vertex could be in
         * This defines a range we can check for "empty" semesters that do not contain any courses in any of the concerned paths
         * For each empty semester we find, we need to validate it by seeing that there are no courses between it and the vertex in each path
         * If there are no valid empty semesters, we need to merge forward to the farthest/max semester and push all post reqs in other paths forward by a dynamic number of semesters that needs to be kept at a min
        */
        // TODO: Is it possible for either of these to be -1? if so we need to figure out some error handeling
        const minSemesterIndex = mergedSemesters.findIndex(semester => semester.find(vertex => vertex.courseCode === courseCode))
        const maxSemesterIndex = mergedSemesters.findLastIndex(semester => semester.find(vertex => vertex.courseCode === courseCode))
        // Will be -1 while there is no valid semester to merge to, otherwise it is the index of the mergedSemesters array
        let validMergeSemesterIndex = -1
        // Find empty semesters and check if they are valid candidates
        // TODO: double check this range is actually what we want
        for (let currentSemesterIndex = minSemesterIndex; currentSemesterIndex <= maxSemesterIndex; currentSemesterIndex++) {
            const currentSemester = currentSemesterIndex + 1
            const duplicateVertices: Map<number, Analytics.Vertex> = new Map
            let isEmptySemester = true
            for (let j = 0; j < paths.length; j++) {
                const duplicateVertex = paths[j].find(vertex => vertex.courseCode === courseCode)
                duplicateVertices.set(j, duplicateVertex)
                if (duplicateVertex.semester === currentSemester) continue
                const blockingVertex: Analytics.Vertex | undefined = paths[j].find(vertex => vertex.courseCode !== courseCode && vertex.semester === currentSemester && vertex.semester !== duplicateVertex.semester)
                // Semester is not a valid candidate for merging
                if (blockingVertex !== undefined) {
                    isEmptySemester = false
                    break
                }
            }
            if (isEmptySemester) {
                let isValidSemester = true
                // Validate that we can actually merge to it
                // Rule for a valid merge:
                // 1. Must be adjacent to or in the same semester as all duplicate vertices OR
                // 2. Must not have any pre/post reqs (depending on direction) between the duplicate and the candidate semester
                for (const [pathIndex, duplicateVertex] of duplicateVertices) {
                    const semesterDistance = Math.abs(duplicateVertex.semester - currentSemester)
                    // Semester is valid if the semesters are adjacent
                    if (semesterDistance <= 1) continue
                    const path = paths[pathIndex]
                    const intermediaryCourses = path.filter(vertex => currentSemester > duplicateVertex.semester ? vertex.semester > duplicateVertex.semester && vertex.semester < currentSemester : vertex.semester < duplicateVertex.semester && vertex.semester > currentSemester)
                    // If there are no courses blocking the duplicate from merging, then it is a valid semester
                    if (intermediaryCourses.length === 0) continue
                    // Default case: the current semester is not valid
                    isValidSemester = false
                    break
                }
                if (isValidSemester) {
                    validMergeSemesterIndex = currentSemesterIndex
                    break
                }
            }
        }

        // If we could not merge the course, we need to merge it forward and push all post reqs back
        if (validMergeSemesterIndex === -1) {
            mergedVertex.semester = maxSemesterIndex + 1
            // Grab the first layer of post-reqs from the merged vertex
            const firstLayerPostReqs = mergedSemesters.flat().filter(v => mergedVertex.edges.find(edge => edge.courseCode === v.courseCode))
            for (const node of firstLayerPostReqs) {
                // Move the postreq forward the smallest amount we can
                // NOTE: I don't think it matters if a post-req is itself is a duplicate
                const vertex = mergedSemesters.flat().find(vertex => vertex.courseCode === node.courseCode)
                if (mergedVertex.semester > vertex.semester ) { // Layer 1 post-req has ended up behind the current course
                    // We need to shift the current "branch" starting from the current vertex
                    await ShiftBranch(vertex, mergedVertex, mergedSemesters)
                }
            }
        } else {
            // We found a semester we can merge to, however we still need look to see if any post-reqs need pushing back
            mergedVertex.semester = validMergeSemesterIndex + 1
            for (const edge of mergedVertex.edges) { // LATER: Look at seeing if we can optimize this step
                const currVertex = mergedSemesters.flat().find(v => v.courseCode === edge.courseCode)
                await ShiftBranch(currVertex, mergedVertex, mergedSemesters)
            }
        }
        // Remove any occurance of the duplicate before inserting the merged instance
        for (let i = 0; i < mergedSemesters.length; i++) {
            const currSemester = mergedSemesters[i]
            let duplicateIndex = currSemester.findIndex(vertex => vertex.courseCode === courseCode)
            while (duplicateIndex !== -1) {
                currSemester.splice(duplicateIndex, 1)
                duplicateIndex = currSemester.findIndex(vertex => vertex.courseCode === courseCode)
            }
        }
        // Replace/insert the merged vertex into the proper semester
        mergedSemesters[mergedVertex.semester - 1].push({ ...mergedVertex })
    }

    // NOTE: All of the moving around before this point has been purely on paper, the actual location of the courses has not changed (yet)
    // Cleanup step: Ensure all courses are in the correct semesters after we've been shifting them around
    const mergedSemestersCopy = [ ...mergedSemesters ]
    for (let i = 0; i < mergedSemesters.length; i++) {
        const semester = mergedSemesters[i]
        for (const course of semester) {
            if (course.semester - 1 !== i) {
                // Remove old vertex
                const oldSemesterIndex = mergedSemestersCopy.findIndex(sem => sem.find(v => v.courseCode === course.courseCode))
                const oldVertexIndex = mergedSemestersCopy[oldSemesterIndex].findIndex(vertex => vertex.courseCode === course.courseCode)
                mergedSemestersCopy[oldSemesterIndex].splice(oldVertexIndex, 1)
                // Add an extra semester if we need to
                if (course.semester > mergedSemestersCopy.length) mergedSemestersCopy.push([])
                // Add new vertex
                mergedSemestersCopy[course.semester - 1].push(course)
            }
        }
    }

    mergedCurriculum.semesters = mergedSemestersCopy
    return mergedCurriculum
}

async function OptimizeCurriculum(curriculum: Analytics.Curriculum): Promise<Analytics.Curriculum> {
    return curriculum
}

// NOTE: I'm worried that this could lead to bugs where a course is in the path of multiple duplicates (or is itself a duplicate) and ends up being moved somewhere it shouldn't
async function ShiftBranch(currentVertex: Analytics.Vertex, previousVertex: Analytics.Vertex, semesters: Analytics.Vertex[][]): Promise<void> {
    if (previousVertex.edges.map(edge => edge.courseCode).includes(currentVertex.courseCode)) {
        // Co-req
        currentVertex.semester = previousVertex.semester
        return 
    }
    const currentEdges: string[] = currentVertex.edges.map(e => e.courseCode)
    const currentSemester = currentVertex.semester
    const previousSemester = previousVertex.semester
    const courses = semesters.flat()
    const postreqs: Analytics.Vertex[] = courses.filter(v => currentEdges.includes(v.courseCode))
    if (currentSemester <= previousSemester) { // Move courses that are not in the correct semester
        currentVertex.semester = previousSemester + 1
    }
    for (const edgeNode of postreqs) {
        await ShiftBranch(edgeNode, currentVertex, semesters)
    }
}

async function calculateCoursePath(course: Analytics.Vertex, curriculum: Analytics.Curriculum, foundNodes: Analytics.Vertex[] = [], isLookingForward?: boolean): Promise<Analytics.Vertex[]> {
    const path: Analytics.Vertex[] = [
        // Look forward one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === true 
            ? curriculum.semesters.flat().filter(vertex => course.edges.map(edge => edge.courseCode).includes(vertex.courseCode))
            : []
        ),
        // Look backwards one layer, if possible
        ...(isLookingForward === undefined || isLookingForward === false 
            ? curriculum.semesters.flat().filter(vertex => vertex.edges.map(edge => edge.courseCode).includes(course.courseCode))
            : []
        )
    ]

    if (isLookingForward === undefined) path.push(course)

    for (const node of path) {
        if (foundNodes.includes(node)) continue
        foundNodes.push(node)
        await calculateCoursePath(node, curriculum, foundNodes, isLookingForward === undefined ? node.edges.find(edge => edge.courseCode === course.courseCode) === undefined : isLookingForward)
    }

    return foundNodes
}