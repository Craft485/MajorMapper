import { Program } from '../types/university'
import { ProgramList } from '../types/backend'
import { Curriculum } from '../types/analytics'

const allPrograms: { [stack: string]: Program } = {},
colleges: string[] = [],
locations: string[] = [],
container = document.getElementById('container'),
canvas = document.querySelector<HTMLCanvasElement>('#canvas'),
ctx = canvas.getContext('2d'),
width = window.innerWidth,
height = window.innerHeight

let selection = ''

canvas.height = height
canvas.width = width

// Called within the html directly
// FIXME: Swtich to using appendChild as updating the html as a string will reset all dropdowns
const addCurriculum = (): string => container.innerHTML += selection

function requestProgramListData(): void {
    fetch('/major-info', { method: 'POST' })
        .then(r => r.json())
        .then((data: ProgramList[]) => {
            data.forEach(program => {
                allPrograms[program.ProgramStack] = {
                    ProgramTitle: program.ProgramTitle,
                    DegreeCode: program.DegreeCode,
                    LocationCode: program.LocationCode,
                    CollegeCode: program.CollegeCode,
                    HasMajorMap: program.HasMajorMap,
                    DisplayDegree: program.DisplayDegree,
                    ProgramStack: program.ProgramStack
                }
                // TODO: Add current program to list of options in DOM
                if (!locations.includes(program.LocationCode)) {
                    locations.push(program.LocationCode)
                    document.querySelector('.location-select-menu > select').innerHTML += `<option value='${program.LocationCode.replaceAll(' ', '-')}'>${program.LocationCode}</option>`
                }
                if (!colleges.includes(program.CollegeCode)) {
                    colleges.push(program.CollegeCode)
                    document.querySelector('.college-select-menu > select').innerHTML += `<option value='${program.CollegeCode.replaceAll(' ', '-')}'>${program.CollegeCode}</option>`
                }
                document.querySelector('.fos-select-menu > select').innerHTML += `<option value='${program.ProgramStack}'>${program.ProgramTitle}`
            })
            selection = document.querySelector('.program-selector').outerHTML
        })
        .catch(console.error)
}

/** Called from the HTML */
function submit(): void {
    const stacks = Array.from(document.querySelectorAll<HTMLSelectElement>('.fos-select-menu > select')).map(element => element?.value).filter(Boolean)
    if (stacks.length) {
        fetch(`/submit?q=${stacks.join(',')}`, { method: 'POST' })
            .then(r => r.json())
            .then(render)
    }
}

function render(renderData: { data: Curriculum }) {
    const curricula = renderData.data, semesters = curricula.semesters
    console.log(renderData.data)
    // Setup/clear canvas
    canvas.classList.add('active')
    ctx.fillStyle = 'black'
    ctx.fillRect(0, 0, width, height)

    // Draw contents of renderData to screen
    for (const semester of semesters) {
        for (const course of semester) {
            
        }
    }
}

/** Called from HTML */
const exitCanvas = (): void => canvas.classList.remove('active')

window.onload = () => {
    console.info('Pinning for the fjords')
    requestProgramListData()
}