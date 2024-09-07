import { Curriculum } from "../types/analytics"

const contentContainer = document.getElementById('program-content')

function showPreReqs(course: HTMLSpanElement, foundEdges: string[] = [], isLookingForward?: boolean): void {
    if (isLookingForward === undefined) Array.from(document.querySelectorAll<HTMLSpanElement>('.prereq-shown')).forEach(e => e.classList.remove('prereq-shown'))
    course.classList.add('prereq-shown')
    if (foundEdges.length === 0) foundEdges.push(course.id)
    const edges: string[] = []
    // Look forward
    const forwardEdges = isLookingForward === undefined || isLookingForward === true ? course.getAttribute('edges').split(',').filter(Boolean) : []
    // Look back
    const behindEdges = isLookingForward === undefined || isLookingForward === false ? Array.from(document.querySelectorAll<HTMLSpanElement>(`[edges*=${course.id}]`)).map(e => e.id) : []
    edges.push(...forwardEdges, ...behindEdges)
    for (const edge of edges) {
        if (foundEdges.includes(edge)) continue
        const edgeElement = document.getElementById(edge)
        edgeElement.classList.add('prereq-shown')
        foundEdges.push(edge)
        // Recurse from the current edge
        showPreReqs(edgeElement, foundEdges, isLookingForward === undefined ? forwardEdges.includes(edge) : isLookingForward)
    }
}

function render(renderData: { data: Curriculum }): void {
    const curricula = renderData.data, semesters = curricula.semesters
    contentContainer.innerHTML = ''
    contentContainer.parentElement.classList.add('active')

    for (const semester of semesters) {
        const column = document.createElement('div')
        column.className = 'semester'
        for (const course of semester) {
            const courseBlock = document.createElement('span')
            courseBlock.id = course.courseCode
            courseBlock.className = 'course'
            courseBlock.setAttribute('edges', course.edges.join(','))
            courseBlock.innerHTML = `
                <p class="course-code">${course.courseCode}</p>
                <div class="context-menu">
                    <p>Credits: <span class="credits">${course.credits}</span></p>
                    <p class="course-name">${course.courseName}</p>
                </div>`
            courseBlock.addEventListener('click', e => showPreReqs(courseBlock))
            column.appendChild(courseBlock)
        }
        contentContainer.appendChild(column)
    }
}