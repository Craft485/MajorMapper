import { Curriculum } from "../types/analytics"

const contentContainer = document.getElementById('semesters'),
renderer = document.getElementById('renderer'),
canvas = document.querySelector<HTMLCanvasElement>('#canvas'),
ctx = canvas.getContext('2d'),
paths = new Map<string, Path2D>(),
SVGPaths: [label: string, path: string][] = []

let ClearCanvas = true,
verticalSpacing = window.innerHeight * 0.05,
halfVerticalSpacing = verticalSpacing / 2,
lastClickedCourse: HTMLSpanElement = null

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
    endX = endingElementBoundingBox.x + (startingSemester === endingSemester ? endingElementBoundingBox.width : 0),
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
    // NOTE: We don't need to account for scrolling in the x direction here, only the y
    let path = `M${startX},${startY + window.scrollY} 
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
            ? halfWidth - Math.abs(randomXOffset) // Courses are in adjacent semesters
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
        : halfWidth - Math.abs(randomXOffset)
    },0`.replaceAll(/(\n|\t)+/g, '').replaceAll(/\s{2,}/g, ' ')

    const actualDeltaX = path.split(' ').map(str => str.startsWith('l') ? parseFloat(str.split(',')[0].substring(1)) : 0).reduce((acc, curr) => acc + curr, 0)

    if (actualDeltaX < deltaX) path += ` l${deltaX - actualDeltaX},0`

    // Add endcap/arrow
    path += ` l${startingSemester === endingSemester ? '' : '-'}${endingElementBoundingBox.height / 6},${endingElementBoundingBox.height / 6} l0,-${endingElementBoundingBox.height / 3 - 0.5} l${startingSemester === endingSemester ? '-' : ''}${endingElementBoundingBox.height / 6},${endingElementBoundingBox.height / 6}`

    console.log(path)

    const label = `${startingElement.id}|${endingElement.id}`
    SVGPaths.push([label, path])
    paths.set(label, new Path2D(path))

    return new Path2D(path)
}

function showPreReqs(course: HTMLSpanElement, foundEdges: string[] = [], isLookingForward?: boolean): void {
    if (isLookingForward === undefined && ClearCanvas) {
        Array.from(document.querySelectorAll<HTMLSpanElement>('.prereq-shown')).forEach(e => e.classList.remove('prereq-shown'))
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        document.getElementById('show-all-lines-toggle').classList.add('toggled-off')
        document.getElementById('show-all-lines-toggle').classList.remove('toggled-on')
        lastClickedCourse = course
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
    document.getElementById('show-all-lines-toggle').classList.remove('toggled-on')
    document.getElementById('show-all-lines-toggle').classList.add('toggled-off')
    const curricula = renderData.data, semesters = curricula.semesters
    contentContainer.innerHTML = ''
    renderer.classList.add('active')
    paths.clear()
    SVGPaths.length = 0
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    let semesterCount = 1

    for (let i = 0; i < semesters.length; i++) {
        const semester = semesters[i]
        const column = document.createElement('div')
        column.className = 'semester'
        for (const course of semester) {
            const courseBlock = document.createElement('span')
            courseBlock.id = course.courseCode
            courseBlock.className = 'course'
            courseBlock.setAttribute('edges', course.edges.join(','))
            courseBlock.setAttribute('semester', `${semesterCount}`)
            courseBlock.setAttribute('course-hex', course.color)
            courseBlock.style.cssText = `--course-hex: #${course.color};` // Expose the hex code to the css
            courseBlock.innerHTML = `
                <p class="course-code"><abbr title="${course.courseCode}">${course.courseCode}</abbr></p>
                <div class="context-menu">
                    <p>Credits: <span class="credits">${course.credits}</span></p>
                    <p class="course-name"><abbr title="${course.courseCode}">${course.courseName}</abbr></p>
                    <div class="metrics">
                        <fieldset class="blocking-factor">
                            <legend><abbr title="Blocking Factor">BF</abbr></legend>
                            ${course.metrics.blockingFactor || 'N/A'}
                        </fieldset>
                        <fieldset class="delay-factor">
                            <legend><abbr title="Delay Factor">DF</abbr></legend>
                            ${course.metrics.delayFactor || 'N/A'}
                        </fieldset>
                        <fieldset class="centrality">
                            <legend><abbr title="Centrality Factor">CF</abbr></legend>
                            ${course.metrics.centrality || 'N/A'}
                        </fieldset>
                        <fieldset class="complexity">
                            <legend><abbr title="Structural Complexity">SC</abbr></legend>
                            ${course.metrics.structualComplexity || 'N/A'}
                        </fieldset>
                    </div>
                </div>`
            courseBlock.addEventListener('click', _ => showPreReqs(courseBlock))
            courseBlock.addEventListener('mouseover', _ => UpdateContextMenuPos(courseBlock))
            column.appendChild(courseBlock)
        }
        semesterCount++
        const columnParent = document.createElement('div')
        columnParent.className = 'semester-container'
        const semesterInfoBlock = document.createElement('div')
        semesterInfoBlock.className = 'semester-info'
        semesterInfoBlock.innerHTML = `
            <p>Semester ${i + 1}</p>
            <p>${semester.reduce((acc, curr) => acc + curr.credits, 0)} Credit Hours</p>
            <p><abbr title="Semester Structural Complexity">SSC</abbr>: ${semester.reduce((acc, curr) => acc + curr.metrics.structualComplexity, 0)}</p>
        `
        columnParent.appendChild(semesterInfoBlock)
        columnParent.appendChild(column)
        contentContainer.appendChild(columnParent)
    }
    // Content overflow handling
    renderer.style.height = `${window.outerHeight}px`
    renderer.style.width = `${window.outerWidth}px`
    canvas.height = window.outerHeight
    canvas.width = window.outerWidth
    verticalSpacing = window.outerHeight * 0.05
    halfVerticalSpacing = verticalSpacing / 2
    document.body.style.cssText = `--course-vertical-spacing: ${verticalSpacing}px;`
    ctx.lineWidth = 5
}

// Function to check for context menus creating overflow, and fixing them if so
function UpdateContextMenuPos(parent: HTMLSpanElement) { // FIXME: This breaks on scroll, think it has something to do with the "bottom" of the page being bigger than what we assume here
    const menu = parent.querySelector<HTMLDivElement>('.context-menu')
    const { x, y, height, width } = menu.getBoundingClientRect()
    const parentRect = parent.getBoundingClientRect()
    if (y + height > window.innerHeight) {
        menu.style.top = `${parentRect.y - height}px`
    }
    if (x + width > window.innerWidth) {
        menu.style.right = '0'
    }
}

const submenus = Array.from(document.querySelectorAll<HTMLElement>('#sub-menus > article'))

/* Accessed from the HTML */
function ToggleSubMenu(menu: string) {
    const submenu = menu ? document.querySelector<HTMLElement>(`#sub-menus > #${menu}`) : null
    if (!submenu && menu !== '') {
        console.log(`Unable to find sub-menu ${menu}`)
        return
    }
    submenus.forEach(element => element.style.display = 'none')
    if (submenu) {
        document.getElementById('sub-menus').style.display = 'flex'
        document.getElementById('sub-menu-clear').style.display = 'block'
        submenu.style.display = 'block'
    } else {
        document.getElementById('sub-menus').style.display = 'none'
        document.getElementById('sub-menu-clear').style.display = 'none'
    }
}

/* Called from both HTML and JS */
function ShowAllLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const toggle = document.getElementById('show-all-lines-toggle')
    if (toggle.classList.contains('toggled-off')) {
        toggle.classList.remove('toggled-off')
        toggle.classList.add('toggled-on')
        // Draw all requisite lines to the canvas
        ClearCanvas = false
        Array.from(document.querySelectorAll<HTMLElement>('.course')).forEach(e => e.click())
        ClearCanvas = true
        lastClickedCourse = null
    } else if (toggle.classList.contains('toggled-on')) {
        toggle.classList.remove('toggled-on')
        toggle.classList.add('toggled-off')
        Array.from(document.querySelectorAll<HTMLElement>('.course')).forEach(e => e.classList.remove('prereq-shown'))
    }
}

function DegreePlanOnScroll() {
    paths.clear()
    const updatedSVGPaths: typeof SVGPaths = []
    for (const [label, path] of SVGPaths) {
        const courses = label.split('|')
        const startingElementBounds = document.getElementById(courses[0]).getBoundingClientRect()
        /* DEBUG: This check is for testing purposes only */ 
        // if (courses[0] === 'ENGL1001') console.log(`${startingElementBounds.x} + ${startingElementBounds.width} = ${startingElementBounds.x + startingElementBounds.width}`)
        // Update the M instruction to be the new start point based on the courses bounding box
        // NOTE: We don't need to worry about the exact amount of scrolling that has occured in the x direction, bounding rect is enough
        const newPath = path.replace(/^M\-?(\d+(?:.\d+)?),\-?(\d+(?:.\d+)?)/, _ => `M${startingElementBounds.x + startingElementBounds.width},${startingElementBounds.y + (startingElementBounds.height / 2) + window.scrollY}`)
        // Save the new path
        updatedSVGPaths.push([label, newPath])
        paths.set(label, new Path2D(newPath))
    }
    SVGPaths.length = 0
    SVGPaths.push(...updatedSVGPaths)
    // Force the canvas to redraw the lines (should be able to use the cached lines)
    const toggle = document.getElementById('show-all-lines-toggle')
    if (toggle.classList.contains('toggled-on')) { // Deal with showing all lines
        toggle.classList.remove('toggled-on') // Lies and deceit to trick the ShowAllLines function into doing what we need
        toggle.classList.add('toggled-off')
        ShowAllLines()
    } else {
        lastClickedCourse?.click() // Showing only the lines that stem from a single course
    }
}

contentContainer.addEventListener('scroll', _ => DegreePlanOnScroll())
