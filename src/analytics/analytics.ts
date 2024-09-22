import { readFile } from 'fs'
import * as Analytics from '../types/analytics'

// TODO: Calculate metrics for the curricula
export async function ParseAnalytics(programStacks: string[]): Promise<Analytics.Curriculum> {
    const curricula: Analytics.Curriculum[] = []
    // Load the curriculum data
    for (const programStack of programStacks) {
        readFile(`../server/utils/json/${programStack}.json`, { encoding: 'utf-8' }, (err, fileContents) => {
            if (err) throw err
            curricula.push(JSON.parse(fileContents).data)
        })
    }
    // Return early if needed
    if (curricula.length === 1) return curricula[0]

    const mergedCurricula = await MergeCurricula(curricula)
    const optimizedDegreePlan = await OptimizeCurriculum(mergedCurricula)
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
            const vertex = currentCurriculum.semesters.flat().find(vertex => vertex.courseCode === courseCode)
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
         * 
         * NOTE: Not sure if this deals with a path containing two or more (different) duplicate courses, it doesn't look like this method is independent of the larger process
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

        // TODO: If we could not merge the course, we need to merge it forward and push all post reqs back
        if (validMergeSemesterIndex === -1) {
            mergedVertex.semester = maxSemesterIndex - 1
            for (const curriculum of familiarCurricula) {
                const postReqNodes = []
                calculateCoursePath(mergedVertex, curriculum, postReqNodes, true)
            }
        }
        // Remove duplicates that are not at the location of the merged vertex

        // Replace/insert the merged vertex into the proper semester
    }

    // Not needed if mergedSemesters is already an object reference to semester prop
    //mergedCurriculum.semesters = mergedSemesters
    return mergedCurriculum
}

async function OptimizeCurriculum(curriculum: Analytics.Curriculum): Promise<Analytics.Curriculum> {
    return curriculum
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