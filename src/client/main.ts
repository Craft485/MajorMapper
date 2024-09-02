import { Program } from '../types/university'
import { ProgramList } from '../types/backend'
import { Curriculum } from '../types/analytics'

if (!render) var render = () => console.error('No render method found')

const allPrograms: { [stack: string]: Program } = {},
colleges: string[] = [],
locations: string[] = [],
container = document.getElementById('container')

let selection = ''

// Called within the html directly
const addCurriculum = (): void => {
    const child = document.createElement('div')
    child.className = 'program-selector'
    child.innerHTML = selection
    container.appendChild(child)
}

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
            selection = document.querySelector('.program-selector').innerHTML
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

/** Called from HTML */
const exitRender = (): void => document.getElementById('renderer').classList.remove('active')

window.onload = () => {
    console.info('Pinning for the fjords')
    requestProgramListData()
}