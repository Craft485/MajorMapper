import { Curriculum, Vertex, Edge, Metrics } from '../types/analytics'
import { calculateCoursePath } from './utils'

/** Metrics are based on https://curricularanalytics.org/help/metrics and https://cran.r-project.org/web/packages/CurricularAnalytics/vignettes/CurricularAnalytics.html */
export async function CalculateMetrics(curriculum: Curriculum): Promise<Curriculum> {
    const courses: Vertex[] = curriculum.semesters.flat()
    curriculum.structuralComplexity = 0
    for (const vertex of courses) { // Loop over every vertex in the graph, calculate the courses metrics and total them to find all the degree plans metrics at the same time
        // Get all courses that relate to the current course of interest, excluding any that have a mutual co-req relationship with the current vertex
        const subset = (await calculateCoursePath(vertex, curriculum)).filter(course => !(course.edges.includes(vertex.courseCode) && vertex.edges.includes(course.courseCode)))
        // Build an array of all path permutations through the current vertex of interest
        const paths = await BuildPathPermutations(subset)
        const pathLengths = paths.map(path => path.length)
        // DF will be the longest path present in the list of path permutations
        const DelayFactor = Math.max(...pathLengths)
        // Calculate BF by finding the number of all unique courses that occur after the current course
        const BlockingFactor = paths.map(path => path.slice(path.findIndex(course => course.courseCode === vertex.courseCode) + 1)).flat().filter((v, i, a) => a.findIndex(c => c.courseCode === v.courseCode) === i).length
        const Centrality = pathLengths.reduce((acc, curr) => acc + curr, 0)

        vertex.metrics = {
            delayFactor: DelayFactor,
            blockingFactor: BlockingFactor,
            centrality: Centrality,
            structualComplexity: DelayFactor + BlockingFactor
        }
        curriculum.structuralComplexity += vertex.metrics.structualComplexity
    }
    return curriculum
}

export async function BuildPathPermutations(courses: Vertex[], permutations: Vertex[][] = []): Promise<Vertex[][]> {
    if (permutations.length === 0) { // This call is the top of the recurse chain
        const sourceNodes = courses.filter(course => courses.find(vertex => vertex.edges.includes(course.courseCode)) === undefined)
        for (const node of sourceNodes) { // Recursively build paths stemming from each source node
            permutations.push(...await BuildPathPermutations(courses, [[node]]))
        }
        // console.log(permutations.map(path => path.map(v => v.courseCode).join(' -> ')).join('\n') + '\n\n\n\n')
        return permutations
    } else {
        const newPermutations: Vertex[][] = []
        let sinkNodeCount = 0
        for (const permutation of permutations) {
            const lastNode = permutation.at(-1)
            const nextNodes = courses.filter(course => lastNode.edges.includes(course.courseCode) && !course.edges.includes(lastNode.courseCode))
            if (nextNodes.length === 0) { // If we have already finished building this path, just save it and move on
                newPermutations.push(permutation)
                sinkNodeCount++
                continue
            }
            for (const newNode of nextNodes) {
                newPermutations.push(permutation.concat(newNode))
            }
        }
        // console.log(newPermutations.map(path => path.map(v => v.courseCode).join(' -> ')).join('\n') + '\n\n\n\n')
        // If every path we have ends in a sink node, then we are done, otherwise we need to recurse
        return sinkNodeCount === permutations.length ? permutations : await BuildPathPermutations(courses, newPermutations)
    }
}
