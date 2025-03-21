import { Program } from '../types/university'
import { ProgramList } from '../types/backend'

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
                // If location for current progam is not an option, add it
                if (!locations.includes(program.LocationCode)) {
                    locations.push(program.LocationCode)
                    document.querySelector('.location-select-menu > select').innerHTML += `<option value='${program.LocationCode}'>${program.LocationCode}</option>`
                }
                // If college for current program is not an option, add it
                if (!colleges.includes(program.CollegeCode)) {
                    colleges.push(program.CollegeCode)
                    document.querySelector('.college-select-menu > select').innerHTML += `<option value='${program.CollegeCode}'>${program.CollegeCode}</option>`
                }
                // Add the program as an option in the dropdown
                document.querySelector('.fos-select-menu > select').innerHTML += `<option value='${program.ProgramStack}'>${program.ProgramTitle}`
            })
            selection = document.querySelector('.program-selector').innerHTML
        })
        .catch(console.error)
}

/** Called from the HTML */
const submit = (): void => {
    const stacks = Array.from(document.querySelectorAll<HTMLSelectElement>('.fos-select-menu > select')).map(element => element?.value).filter(Boolean)
    document.getElementById('stacks').innerText = stacks.map(stack => allPrograms[stack].ProgramTitle).join(' + ')
    if (stacks.length) {
        fetch(`/submit?q=${stacks.join(',')}`, { method: 'POST' })
            .then(r => r.json())
            .then(render)
    }
}

// Event handler to apply filters to the FOS selection
window.addEventListener('change', e => {
    const element: HTMLSelectElement = e.target as HTMLSelectElement
    console.log(element)
    if (element.parentElement.classList.contains('fos-select-menu')) return
    const FOSMenu: HTMLSelectElement = element.parentElement.parentElement.querySelector('.fos-select-menu > select')
    if (element.tagName === 'SELECT') { // Checking for is the change occured on a select element
        // Update FOS selector based on all currently selected filters
        const filters = Array.from(element.parentElement.parentElement.querySelectorAll('.select-menu')).map((e: HTMLSelectElement) => [e.getAttribute('filter') || null, e.selectedOptions[0].value || null]).slice(0, -1).filter(v => v[0] !== null && v[1] !== null)
        let filteredFOSStacks = [...Object.keys(allPrograms)]
        for (const [filter, value] of filters) filteredFOSStacks = filteredFOSStacks.filter(stack => allPrograms[stack][filter] === value)
        FOSMenu.innerHTML = `<option value=''>--- Select Field of Study ---</option>`
        for (const stack of filteredFOSStacks) FOSMenu.innerHTML += `<option value='${stack}'>${allPrograms[stack].ProgramTitle}`
    }
})

/** Called from HTML */
const exitRender = (): void => document.getElementById('renderer').classList.remove('active')

window.onload = () => {
    console.info('Pinning for the fjords')
    requestProgramListData()
}