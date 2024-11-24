import { Curriculum, Vertex } from '../types/analytics'
import { calculateCoursePath, ShiftBranch, DeepCopy } from './utils'

const { max:MAX, min:MIN } = Math

export async function OptimizeCurriculum(curriculum: Curriculum): Promise<Curriculum> {
    console.log('Starting optimize step')
    const originalSemesters: Vertex[][] = curriculum.semesters
    const optimizedSemesters: Vertex[][] = DeepCopy(originalSemesters)
    const creditHours = optimizedSemesters.map(s => s.reduce((total, course) => total + course.credits, 0))
    console.log(`Initial credit hours: ${creditHours.join(', ')}`)
    while (MAX(...creditHours) > 18) { // While there are semesters out there that are still over 18 credit hours...
        console.log('Point A')
        const currentSemesterIndex = optimizedSemesters.findIndex((_, semesterIndex) => semesterIndex === creditHours.findIndex(hours => hours === MAX(...creditHours)))
        console.log('Optimizing semester index ' + (currentSemesterIndex))
        const currentSemester = optimizedSemesters[currentSemesterIndex]
        const foundPaths: string[] = [] // Used to keep track of the course codes that we have calculated simple paths for
        const pathLengths: number[] = []
        const simplePaths: Vertex[][] = [] // This array is parralel with foundPaths
        for (const course of currentSemester.flat()) { // For each course in the curriculum, calculate and store its simple path
            if (foundPaths.includes(course.courseCode)) continue
            const simplePath = await calculateCoursePath(course, curriculum)
            const pathLength = simplePath.filter((v, i, a) => i === a.map(x => x.semester).indexOf(v.semester)).length
            let pathIndex = pathLengths.findLastIndex(length => length <= pathLength)
            if (pathIndex < 0) pathIndex = MAX(pathLengths.length - 1, 0)
            foundPaths.splice(pathIndex, 0, course.courseCode)
            pathLengths.splice(pathIndex, 0, pathLength)
            simplePaths.splice(pathIndex, 0, simplePath)
        }
        /**
        for each path in simple paths
            While there are still potential semesters to check
                Pick a course whos corresponding simple path is the shortest within the current problem semester
                Pick the earliest semester that
                1. Satisfies the following inequality: (Candidate semester credit hour sum) + (candidate course to move out of problem semester credit hours) <= 18
                2. The candidate semester has minimum credit hours
                if there exists no such candidate, break out of this while
                otherwise, try to shift the branches in the current path
                check if the shift was valid
                if it was valid, update the outer variables with this new information and break
            If the current problem semester is now valid, break out of the for loop
        */
        let successfulShiftOccurred = false
        // For each simple path (starting with the shortest)
        for (let i = 0; i < simplePaths.length; i++) {
            console.log('Point B')
            console.log(simplePaths[i].map(v => v.courseCode).join(', '))
            // Gather basic information about the path and the course we are trying to move out of the current semester
            const path: Vertex[] = DeepCopy<Vertex[]>(simplePaths[i].toSorted((v1, v2) => v1.semester - v2.semester))
            const courseCode: string = foundPaths[i]
            console.log(`Trying to optimize for course ${courseCode} in path ${path.map(v => v.courseCode).join(', ')}`)
            const course: Vertex = DeepCopy<Vertex>(path.find(v => v.courseCode === courseCode)) // Grab a copy of the course, not a pointer
            // Keep track of semesters we don't want to check
            const checkedSemesterIndicies: number[] = [ currentSemesterIndex ] 
            // While there are semesters we could still check
            while (checkedSemesterIndicies.length < optimizedSemesters.length) {
                console.log('Point CCCCCCCCCCCC')
                // Find the earliest possible candidate semester (as an index)
                const candidateSemesters = optimizedSemesters.map((semester, sIndex) => creditHours[sIndex] < 18 ? semester : null)
                const minimumCreditsAmongCandidateSemesters = MIN(...candidateSemesters.filter(Boolean).map(s => s.reduce((acc, v) => acc + v.credits, 0)))
                console.log(`There are ${candidateSemesters.filter(Boolean).length} candidate semesters`)
                const candidateSemesterIndex = candidateSemesters.findIndex((candidate, index) => {
                    if (candidate === null) return false
                    const isNotRepeat = !(checkedSemesterIndicies.includes(index))
                    const hasMinCredits = creditHours[index] === minimumCreditsAmongCandidateSemesters
                    console.log(`${index} | ${isNotRepeat} | ${hasMinCredits}`)
                    return isNotRepeat && hasMinCredits
                })
                // If we were unable to obtain a candidate semester, break out of this loop as we need to either add an additional semester or try to move another course
                if (candidateSemesterIndex === -1) break
                console.log(`Found semester index ${candidateSemesterIndex}`)
                checkedSemesterIndicies.push(candidateSemesterIndex)
                console.log(`Checked ${checkedSemesterIndicies.join(', ')}`)
                const tempCurriculum: Vertex[][] = DeepCopy<Vertex[][]>(optimizedSemesters)
                const tempCourse: Vertex = tempCurriculum.flat().find(c => c.courseCode === courseCode)
                const forwardShift = candidateSemesterIndex > currentSemesterIndex
                // Grab just the part of the path that might be moving (NOTE: Slice will only return a shallow copy so we still need to use DeepCopy to remove any pointers)
                const branches: Vertex[] = DeepCopy<Vertex[]>(forwardShift ? path.slice(path.findIndex(v => v.semester === course.semester)) : path.slice(0, path.findLastIndex(v => v.semester === course.semester)))
                const initialStateOfCreditHours: number[] = tempCurriculum.map(semester => semester.reduce((acc, course) => acc + course.credits, 0))
                const firstLayerNodes = branches.filter(v => forwardShift ? tempCourse.edges.includes(v.courseCode) : v.edges.includes(courseCode))
                // Make the first move manually, then starting shifting each branch
                tempCourse.semester = candidateSemesterIndex + 1
                // Try to make a shift, then later we can check to see if its result is valid
                for (const node of firstLayerNodes) await ShiftBranch(node, tempCourse, tempCurriculum, forwardShift) /// NOTE: This is assuming that the rework of the shift branch util is correct, TEST THIS
                // TODO: Validate the shift somehow, we need to check for valid semesters and that moving the courses didn't cause any other semesters to go above 18 credit hours
                console.log('Validating shift...')
                const postShiftCreditHours: number[] = tempCurriculum.map(semester => semester.reduce((acc, course) => acc + course.credits, 0))
                const shiftWasValid = !(MIN(...branches.map(x => x.semester)) < 1 || postShiftCreditHours.find((hours, i) => hours > 18 && hours > initialStateOfCreditHours[i]))
                if (shiftWasValid) {
                    successfulShiftOccurred = true
                    console.log(`${candidateSemesterIndex} was found to be a valid semester to shift to`)
                    // Once we find a shift thats valid according to the semester properties, we need to actually move the course vertices to other semester arrays
                    for (let i = 0; i < tempCurriculum.length; i++) {
                        const semester = tempCurriculum[i]
                        for (const course of semester) {
                            if (course.semester - 1 !== i) {
                                // Remove old vertex
                                const oldSemesterIndex = tempCurriculum.findIndex(sem => sem.find(v => v.courseCode === course.courseCode))
                                const oldVertexIndex = tempCurriculum[oldSemesterIndex].findIndex(vertex => vertex.courseCode === course.courseCode)
                                tempCurriculum[oldSemesterIndex].splice(oldVertexIndex, 1)
                                // Add an extra semester if we need to
                                if (course.semester > tempCurriculum.length) tempCurriculum.push([])
                                // Add new vertex
                                tempCurriculum[course.semester - 1].push(course)
                            }
                        }
                    }
                    // The shift was valid, save the changes to the main variables
                    optimizedSemesters.length = 0
                    optimizedSemesters.push(...tempCurriculum)
                    // Recalculate credit hours
                    creditHours.length = 0
                    creditHours.push(...optimizedSemesters.map(s => s.reduce((total, course) => total + course.credits, 0)))            
                    break
                }
            }
            // Check if the semester is now valid, if it is, we can break
            if (currentSemester.reduce((acc, v): number => acc + v.credits, 0) <= 18) break
        }
        // If we failed to move anything out of the current semester, we need to add an additional semester
        if (!successfulShiftOccurred) {
            const newSemesterCount = optimizedSemesters.push([]) // FIXME: This is happening regardless of any conditions, under what circumstances do we want to add a new semester?
            console.log(`Added a new semester, there are now ${newSemesterCount} semesters`)
        }
        // Update the credit hours array before going to the next iteration
        creditHours.length = 0
        creditHours.push(...optimizedSemesters.map(s => s.reduce((total, course) => total + course.credits, 0)))
    }
    console.log('Optimize step complete')
    curriculum.semesters = optimizedSemesters
    console.log(JSON.stringify(optimizedSemesters))
    console.log('Final credit hours per semester: '+optimizedSemesters.map(s => s.reduce((total, course) => total + course.credits, 0)).join(', '))
    return curriculum
}