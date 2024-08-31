import { Program } from '../types/university'
import { ProgramList } from '../types/backend'

const UCBaseURL = 'https://webapps2.uc.edu/ecurriculum/degreeprograms/program/majormap/',
coursicleBaseURL = 'https://www.coursicle.com/uc/courses/',
allPrograms: { [stack: string]: Program } = {},
colleges: string[] = [],
locations: string[] = [],
container = document.getElementById('container')

let selection = ''

// Called within the html directly
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
                    console.log(document.querySelector('.location-select-menu > select'))
                }
                if (!colleges.includes(program.CollegeCode)) {
                    colleges.push(program.CollegeCode)
                    document.querySelector('.college-select-menu > select').innerHTML += `<option value='${program.CollegeCode.replaceAll(' ', '-')}'>${program.CollegeCode}</option>`
                }
                document.querySelector('.fos-select-menu > select').innerHTML += `<option value='${program.ProgramTitle.replaceAll(' ', '-')}'>${program.ProgramTitle}`
            })
            selection = document.querySelector('.program-selector').outerHTML
        })
        .catch(console.error)
}

function submit(): void {
    
}

window.onload = () => {
    console.info('Pinning for the fjords')
    requestProgramListData()
}