import { Curriculum, Vertex } from '../types/analytics'

// NOTE: I'm worried that this could lead to bugs where a course is in the path of multiple duplicates (or is itself a duplicate) and ends up being moved somewhere it shouldn't
export async function ShiftBranch(currentVertex: Vertex, previousVertex: Vertex, semesters: Vertex[][], shiftingForward = true): Promise<void> {
    if (previousVertex.edges.includes(currentVertex.courseCode)) {
        // Co-req
        currentVertex.semester = previousVertex.semester
        return 
    }
    const currentEdges: string[] = currentVertex.edges
    const currentSemester = currentVertex.semester
    const previousSemester = previousVertex.semester
    const courses = semesters.flat()
    const dependencies: Vertex[] = courses.filter(v => shiftingForward ? currentEdges.includes(v.courseCode) : v.edges.includes(currentVertex.courseCode))
    if (currentSemester <= previousSemester && shiftingForward) { // Move courses that are not in the correct semester
        currentVertex.semester = previousSemester + 1
    } else if (currentSemester >= previousSemester && !shiftingForward) {
        currentVertex.semester = previousSemester - 1
    }
    for (const node of dependencies) {
        console.log(JSON.stringify(currentVertex))
        console.log(JSON.stringify(node))
        await ShiftBranch(node, currentVertex, semesters)
    }
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
        if (foundNodes.includes(node)) continue
        foundNodes.push(node)
        await calculateCoursePath(node, curriculum, foundNodes, isLookingForward === undefined ? node.edges.find(edge => edge === course.courseCode) === undefined : isLookingForward)
    }

    return foundNodes
}