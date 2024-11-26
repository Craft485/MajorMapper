import { Curriculum, Vertex } from '../types/analytics'

// NOTE: I'm worried that this could lead to bugs where a course is in the path of multiple duplicates (or is itself a duplicate) and ends up being moved somewhere it shouldn't
export async function ShiftBranch(currentVertex: Vertex, previousVertex: Vertex, semesters: Vertex[][], shiftingForward = true): Promise<void> {
    console.log(`Shifting ${currentVertex.courseCode} in semester ${currentVertex.semester} according to ${previousVertex.courseCode} in ${previousVertex.semester} | Is a forward shift: ${shiftingForward}`)
    if (previousVertex.edges.includes(currentVertex.courseCode) && currentVertex.edges.includes(previousVertex.courseCode)) {
        // Co-req
        console.log(`${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}`)
        currentVertex.semester = previousVertex.semester
        console.log(`Since ${currentVertex.courseCode} is a coreq with ${previousVertex.courseCode}, it was shifted to semester ${currentVertex.semester}`)
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
    console.log(`Shifted ${currentVertex.courseCode} to semester ${currentVertex.semester}`)
    for (const node of dependencies) {
        console.log(JSON.stringify(currentVertex))
        console.log(JSON.stringify(node))
        await ShiftBranch(node, currentVertex, semesters, shiftingForward)
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
        if (foundNodes.map(n => n.courseCode).includes(node.courseCode)) continue
        foundNodes.push(node)
        await calculateCoursePath(node, curriculum, foundNodes, isLookingForward === undefined ? node.edges.find(edge => edge === course.courseCode) === undefined : isLookingForward)
    }

    return foundNodes
}

export function DeepCopy<Type>(obj: Type): Type {
    return JSON.parse(JSON.stringify(obj))
}