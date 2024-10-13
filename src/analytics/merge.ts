import { ShiftBranch, calculateCoursePath } from './utils'
import { Curriculum, Vertex } from '../types/analytics'

/**
Identify common courses
For each common course, merge their edges/post-reqs
calculate paths for the course in each curriculum is appears in
use the semester spacing in each path to determine where the duplicate course should be placed for merging
*/
export async function MergeCurricula(curricula: Curriculum[]): Promise<Curriculum> {
    console.log('Starting merge step')
    const mergedCurriculum: Curriculum = {
        semesters: new Array(Math.max(...curricula.flatMap(c => c.semesters.length))).fill(null).map(x => []),
        totalCredits: curricula.reduce((a, b) => a + b.totalCredits, 0) // FIXME: this is just incorrect, once we want to actually use this we'll need to fix it
    }
    console.log(`Generated ${mergedCurriculum.semesters.length} blank semesters`)
    // Create object reference/pointer to the semesters as a shorthand
    const mergedSemesters: Vertex[][] = mergedCurriculum.semesters
    
    const courseListSets: Array<Set<string>> = []

    console.log('Loading course information')
    // For each curriculum, create a Set of all classes course codes
    for (const curriculum of curricula) {
        const allCourses = curriculum.semesters.flat()
        for (const course of allCourses) {
            console.log(JSON.stringify(course))
            mergedSemesters[course.semester - 1].push(course)
        }
        courseListSets.push(new Set(allCourses.map(course => course.courseCode)))
    }
    console.log('Course information loaded')

    for (const a of courseListSets) { // DEBUG
        for (const b of a) {
            console.log(`[Course Info] ${b}`)
        }
    }

    console.log('Checking for duplicate courses')
    // Determine what course codes are shared accross two or more curriculums
    let duplicateCourseCodesSet: Set<string> = new Set()
    for (let i = 0; i < courseListSets.length; i++) {
        for (let j = 0; j < courseListSets.length; j++) {
            if (i === j) continue
            
            const intersection = courseListSets[i].intersection(courseListSets[j])
            
            if (intersection.size > 0) duplicateCourseCodesSet = duplicateCourseCodesSet.union(intersection)
        }
    }
    console.log(`Found ${duplicateCourseCodesSet.size} duplicate courses`)
    // for (const k of duplicateCourseCodesSet) {
    //     console.log(`From dupes set: ${k}`)
    // }

    // For each course that occurs more than once, calcuate its path in all curricula is appears in and determine what semester it needs to be placed in (for now)
    for (const courseCode of duplicateCourseCodesSet) {
        console.log(`Checking duplicate: ${courseCode}`)
        const paths: Vertex[][] = []
        let mergedVertex: Vertex | null = null
        // Grab verticies and curricula for the course code
        const familiarCurricula = curricula.filter(curriculum => curriculum.semesters.flat().map(vertex => vertex.courseCode).includes(courseCode))
        for await (const currentCurriculum of familiarCurricula) {
            // Calculate path for each vertex
            const vertex: Vertex = currentCurriculum.semesters.flat().find(vertex => vertex.courseCode === courseCode)
            const path = await calculateCoursePath(vertex, currentCurriculum)
            if (!mergedVertex) {
                mergedVertex = { ...vertex }
            } else {
                mergedVertex.edges = [...mergedVertex.edges, ...vertex.edges].filter((edge, i, arr) => arr.findIndex(edge2 => edge === edge2) === i)
            }
            console.log(JSON.stringify(mergedVertex))
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
            const duplicateVertices: Map<number, Vertex> = new Map
            let isEmptySemester = true
            for (let j = 0; j < paths.length; j++) {
                const duplicateVertex = paths[j].find(vertex => vertex.courseCode === courseCode)
                duplicateVertices.set(j, duplicateVertex)
                if (duplicateVertex.semester === currentSemester) continue
                const blockingVertex: Vertex | undefined = paths[j].find(vertex => vertex.courseCode !== courseCode && vertex.semester === currentSemester && vertex.semester !== duplicateVertex.semester)
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
            console.log(`No valid semester found to merge ${courseCode} to, merging forward to latest occurance of course`)
            mergedVertex.semester = maxSemesterIndex + 1
            // Grab the first layer of post-reqs from the merged vertex
            const firstLayerPostReqs = mergedSemesters.flat().filter(v => mergedVertex.edges.find(edge => edge === v.courseCode))
            for (const node of firstLayerPostReqs) {
                // Move the postreq forward the smallest amount we can
                // NOTE: I don't think it matters if a post-req is itself is a duplicate
                //const vertex = mergedSemesters.flat().find(vertex => vertex.courseCode === node.courseCode)
                if (mergedVertex.semester > node.semester ) { // Layer 1 post-req has ended up behind the current course
                    console.log(`Shifting branch for ${courseCode} staring at ${node.courseCode}`)
                    // We need to shift the current "branch" starting from the current vertex
                    await ShiftBranch(node, mergedVertex, mergedSemesters)
                }
            }
        } else {
            console.log(`Found a valid candidate semester to merge duplicate ${courseCode} to: ${validMergeSemesterIndex + 1}`)
            // We found a semester we can merge to, however we still need look to see if any post-reqs need pushing back
            mergedVertex.semester = validMergeSemesterIndex + 1
            for (const edge of mergedVertex.edges) { // LATER: Look at seeing if we can optimize this step
                const currVertex = mergedSemesters.flat().find(v => v.courseCode === edge)
                console.log(JSON.stringify(currVertex))
                console.log(edge)
                console.log(`Shifting branch for ${courseCode} starting at ${edge}`)
                await ShiftBranch(currVertex, mergedVertex, mergedSemesters)
            }
        }
        console.log(`Removing excess instances of ${courseCode}`)
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
        console.log(`Completed checks for duplicate: ${courseCode}`)
    }

    // NOTE: All of the moving around before this point has been purely on paper, the actual location of the courses has not changed (yet)
    // Cleanup step: Ensure all courses are in the correct semesters after we've been shifting them around
    console.log('Cleaning up merge step')
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
    console.log('Merge step complete')
    return mergedCurriculum
}