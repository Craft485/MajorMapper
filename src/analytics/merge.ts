import { Curriculum, Vertex } from "../types/analytics"
import { DeepCopy } from "./utils"

/**
 * 
 */
export async function MergeCurricula(curricula: Curriculum[]): Promise<{ [code: string]: Vertex }> {
    // Instead of having a 1D Array to hold the vertex data, we instead use an object literal, this should help 
    // when building the initial list of courses and will be easier to work with during the build step
    // as opposed to using a full curriculum object
    const result: { [code: string]: Vertex } = {}

    // Loop over each curriculum that was passed in
    for (let i = 0; i < curricula.length; i++) {
        const currentCurriculum = curricula[i]
        const courses = currentCurriculum.semesters.flat() // 1D array of the coureses in the current curriculum
        // Loop over each course
        for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
            const currentCourse = courses[courseIndex]
            // If the current course has not been accounted for yet, add it (using DeepCopy to avoid messy obj reference pointers)
            if (!result[currentCourse.courseCode]) {
                result[currentCourse.courseCode] = DeepCopy<Vertex>(currentCourse)
            } else {
                // Current course was already added, merge any additional edges that were not present in the other occurance of the course
                result[currentCourse.courseCode].edges.push(...currentCourse.edges)
                result[currentCourse.courseCode].edges = result[currentCourse.courseCode].edges.filter((v, i, a) => a.indexOf(v) === i)
            }
        }
    }

    return result
}
