import { Curriculum } from "../types/analytics"

const contentContainer = document.getElementById('program-content'),
canvas = document.querySelector<HTMLCanvasElement>('#canvas'),
ctx = canvas.getContext('2d'),
verticalSpacing = window.innerHeight * 0.05,
halfVerticalSpacing = verticalSpacing / 2,
paths = new Map<string, Path2D>()

canvas.height = window.innerHeight
canvas.width = window.innerWidth

ctx.strokeStyle = 'white' // Set default stroke color
ctx.lineWidth = 5

document.body.style.cssText = `--course-vertical-spacing: ${verticalSpacing}px;`

function getRandomRange(min: number, max: number): number {
    return Math.random() * (max - min) + min
}

function calculatePath(startingElement: HTMLElement, endingElement: HTMLElement): Path2D {
    if (paths.has(`${startingElement.id}|${endingElement.id}`)) return paths.get(`${startingElement.id}|${endingElement.id}`)
    const startingSemester = parseInt(startingElement.getAttribute('semester')),
    endingSemester = parseInt(endingElement.getAttribute('semester')),
    startingElementBoundingBox = startingElement.getBoundingClientRect(),
    endingElementBoundingBox = endingElement.getBoundingClientRect(),
    startX = startingElementBoundingBox.x + startingElementBoundingBox.width,
    startY = startingElementBoundingBox.y + (startingElementBoundingBox.height / 2),
    endX = endingElementBoundingBox.x + endingElementBoundingBox.width,
    endY = endingElementBoundingBox.y + (endingElementBoundingBox.height / 2),
    // Height and width will be the same for all course elements on the page
    height = startingElementBoundingBox.height,
    // Width is known to be 50% of a semester columns width, so half of this will be the midpoint bewtween courses in adajcent semesters (hoziontally at least)
    width = startingElementBoundingBox.width,
    halfWidth = width / 2,
    halfHeight = height / 2,
    deltaY = Math.abs(startY - endY),
    deltaX = Math.abs(startX - endX),
    semesterDifference = endingSemester - startingSemester - 1,
    randomXOffset = (Math.random() < 0.5 ? -1 : 1) * getRandomRange(0, 10)
    let path = `M${startX},${startY} 
    l${halfWidth + randomXOffset},0 
    l0,${
        // If endpoint is below start point
        startY < endY
        ? (
            // Move down (positive direction)
            deltaY + (
                // If courses are in adjacent semesters or are in the same semester
                startingSemester + 1 === endingSemester || startingSemester === endingSemester
                ? 0 // Don't move farther down
                : halfHeight + halfVerticalSpacing // Move into open space between courses
            )
        ) : (
            // If endpoint is above start point
            startY > endY
            ? (
                // Move up (negative direction)
                -deltaY - (
                    // If courses are in adjacent semesters or are in the same semester
                    startingSemester + 1 === endingSemester || startingSemester === endingSemester
                    ? 0 // Don't move farther up
                    : halfHeight + halfVerticalSpacing // Move into open space between courses
                )
            ) : (
                // Y values are equal
                startingSemester + 1 === endingSemester
                ? 0 // Semesters are adjacent
                : -(halfHeight + halfVerticalSpacing) // Move up (negative direction) to avoid classes in between semesters
            )
        )
    } 
    l${
        startingSemester === endingSemester 
        ? -halfWidth - randomXOffset // If courses are in the same semester (coreqs)
        : (
            startingSemester + 1 === endingSemester 
            ? halfWidth // Courses are in adjacent semesters
            : 2 * width * semesterDifference
        )
    },0 
    l0,${
        startingSemester === endingSemester || startingSemester + 1 === endingSemester 
        ? 0 
        : (
            // If endpoint is below start point
            startY < endY 
            ? -halfHeight - halfVerticalSpacing 
            : halfHeight + halfVerticalSpacing
        )
    }  
    l${
        startingSemester === endingSemester || startingSemester + 1 === endingSemester 
        ? 0 
        : halfWidth
    },0`.replaceAll(/(\n|\t)+/g, '').replaceAll(/\s{2,}/g, ' ')

    const actualDeltaX = path.split(' ').map(str => str.startsWith('l') ? parseFloat(str.split(',')[0].substring(1)) : 0).reduce((acc, curr) => acc + curr, 0)

    if (actualDeltaX < deltaX) path += ` l${deltaX - actualDeltaX},0`

    console.log(path)

    paths.set(`${startingElement.id}|${endingElement.id}`, new Path2D(path))

    return new Path2D(path)
}

function showPreReqs(course: HTMLSpanElement, foundEdges: string[] = [], isLookingForward?: boolean): void {
    if (isLookingForward === undefined) {
        Array.from(document.querySelectorAll<HTMLSpanElement>('.prereq-shown')).forEach(e => e.classList.remove('prereq-shown'))
        ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
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
        const startNode = forwardEdges.includes(edge) ? course : edgeElement
        const endNode = forwardEdges.includes(edge) ? edgeElement : course
        ctx.strokeStyle = `#${startNode.getAttribute('course-hex')}`
        ctx.stroke(calculatePath(startNode, endNode))
        // Recurse from the current edge
        showPreReqs(edgeElement, foundEdges, isLookingForward === undefined ? forwardEdges.includes(edge) : isLookingForward)
    }
}

function render(renderData: { data: Curriculum }): void {
    const curricula = renderData.data, semesters = curricula.semesters
    contentContainer.innerHTML = ''
    contentContainer.parentElement.classList.add('active')
    paths.clear()
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let semesterCount = 1

    for (const semester of semesters) {
        const column = document.createElement('div')
        column.className = 'semester'
        for (const course of semester) {
            const courseBlock = document.createElement('span')
            courseBlock.id = course.courseCode
            courseBlock.className = 'course'
            courseBlock.setAttribute('edges', course.edges.join(','))
            courseBlock.setAttribute('semester', `${semesterCount}`)
            courseBlock.setAttribute('course-hex', course.color)
            courseBlock.innerHTML = `
                <p class="course-code">${course.courseCode}</p>
                <div class="context-menu">
                    <p>Credits: <span class="credits">${course.credits}</span></p>
                    <p class="course-name">${course.courseName}</p>
                </div>`
            courseBlock.addEventListener('click', e => showPreReqs(courseBlock))
            column.appendChild(courseBlock)
        }
        semesterCount++
        contentContainer.appendChild(column)
    }
}
