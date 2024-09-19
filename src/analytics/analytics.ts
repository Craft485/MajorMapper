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
    const mergedSemesters: Analytics.Vertex[][] = new Array(Math.max(...curricula.flatMap(c => c.semesters.map(a => a.length)))).fill(null).map(x => [])
    
    const courseListSets: Array<Set<string>> = []

    // For each curriculum, create a Set of all classes course codes
    for (const curriculum of curricula) {
        courseListSets.push(new Set(curriculum.semesters.flatMap(semester => semester.map(course => course.courseCode))))
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
                mergedVertex = vertex
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
    }

    mergedCurriculum.semesters = mergedSemesters
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