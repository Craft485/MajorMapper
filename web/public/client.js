// We are unable to do something simple use deconsutrction here because of some oddities with the way that DOM methods work
if (!$) var $ = document.querySelectorAll.bind(document)
if (!id) var id = document.getElementById.bind(document)
if (!createElement) var createElement = document.createElement.bind(document)
if (!qSelect) var qSelect = document.querySelector.bind(document)

const baseURL = 'https://webapps2.uc.edu/ecurriculum/degreeprograms/program/majormap/',
MAX_ITEMS = 10,
/** @type {{[stack: string]: Program}} allPrograms*/
allPrograms = {},
/** @type {Array<Program>} */
selectedProgramList = []

class Program {
    /**
     * @param {{ ProgramTitle?: string,
     *           DegreeCode?: string,
     *           LocationCode?: string,
     *           CollegeCode?: string,
     *           HasMajorMap?: Boolean,
     *           DisplayDegree?: string,
     *           ProgramStack?: string }} props 
     */
    constructor (props) {
        /** @type {string | null} ProgramTitle */
        this.ProgramTitle = props.ProgramTitle || null
        /** @type {string | null} DegreeCode (ex: BSCS) */
        this.DegreeCode = props.DegreeCode || null
        /** @type {string | null} LocationCode (ex: West Campus) */
        this.LocationCode = props.LocationCode || null
        /** @type {string | null} CollegeCode (ex: Engineering & Applied Science) */
        this.CollegeCode = props.CollegeCode || null
        /** @type {boolean} HasMajorMap */
        this.HasMajorMap = props.HasMajorMap || false
        /** @type {string | null} DisplayDegree */
        this.DisplayDegree = props.DisplayDegree || null
        /**
         * @description Ex: 20BC-ASE-BSAERO | Used to create the URL for the major map
         * @type {string | null} ProgramStack 
         */
        this.ProgramStack = props.ProgramStack || null
        /** @type {string[]} Not populated until submit is called */
        this.courseList = []
    }
}

// TODO: Refactor this
function submit() {
    console.clear()
    // Clear previous stuff
    selectedProgramList.length = 0
    // This is a slightly stupid fix to get around obj references
    Object.values(allPrograms).forEach(program => program.courseList.length = 0)
    // Clear lists
    Array.from($('.curriculum .list')).forEach(list => list.innerText = '')
    /** @type {HTMLSelectElement} */
    const majors = Array.from($('select')) || [],
    /** @type {string[]} */
    programStackList = []
    for (const major of majors) programStackList.push(qSelect(`option[value="${major.value}"]`).id)
    fetch(`/submit?q=${programStackList.join(',')}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            // Handle UI updates (bring out to a global function?)
            // Assume that the order that we got the curriculums back is the same order that they are ordered on the page
            const curriculumLists = Array.from($('.curriculum .list'))
            for (let i = 0; i < curriculumLists.length; i++) {
                /** @type {Array<string>} programCoursesList */
                const programCoursesList = [],
                /** @type {HTMLDivElement} curriculumListElement */
                curriculumListElement = curriculumLists[i],
                /** @type {Array<string[]>} Formatted as [[ code, name, credits ], ...] */
                curriculumData = data[i]
                for (const course of curriculumData) {
                    programCoursesList.push(course[0])
                    /** @type {HTMLParagraphElement} listItem */
                    const listItem = createElement('p')
                    listItem.className = `list-item ${course[0]}`
                    // NOTE: I want to change this link to direct the user to a course description page, perhaps somewhere like coursicle
                    listItem.innerHTML = `<a class="list-item-link" href="${baseURL + programStackList[i]}">${course.join(' ')}</a>`
                    curriculumListElement.appendChild(listItem)
                }
                // Setup program to compare, object references should make this a copy in both locations
                allPrograms[programStackList[i]].courseList.push(...programCoursesList)
                selectedProgramList.push(allPrograms[programStackList[i]])
            }
            console.log('UI step')
        })
        .then(() => {
            console.log('compare step')
            console.log($('.list-item'), selectedProgramList.length)
            // Comparing function (NOTE: There is probably a much better way to do this)
            const allCourses = selectedProgramList.map(x => x.courseList.join()).join().split(',')
            let courseCounts = []
            for (const course of allCourses) {
                const alreadyCountedCourseIndex = courseCounts.findIndex(v => v.code === course)
                alreadyCountedCourseIndex === -1 ? courseCounts.push({ code: course, count: 1 }) : courseCounts[alreadyCountedCourseIndex].count++
            }
            // Trim down the array to only the courses shared across all programs
            courseCounts = courseCounts.filter(x => x.count === selectedProgramList.length)
            console.log(selectedProgramList.map(x => x.courseList.join()).join('\n'), courseCounts)
            for (const sharedCourse of courseCounts) {console.log($(`.${sharedCourse.code} a`));Array.from($(`.${sharedCourse.code} a`)).forEach((/** @type {HTMLElement} */ e) => e.classList.add('shared-course'))}
        })
}

// TODO: Change this function to just simply add a new element instead of weirdly changing the innerHTML every time
function addCurriculum() {
    /** @type {HTMLElement} pageContent */
    const pageContent = id('main')
    if (pageContent.children.length < MAX_ITEMS) {
        // This is temporary
        const programs = Array.from(id('major-select-0').children).filter(e => e.innerText !== '-- Select Your Major --').map(x => `<option id="${x.id}" value="${x.innerText}">${x.innerText}</option>`)
        /** @type {HTMLDivElement} newCurriculum */
        const newCurriculum = createElement('div')
        newCurriculum.className = 'curriculum'
        newCurriculum.innerHTML = `
        <div class="selector">
        <label for="major-select">Curriculum: </label>
        <select name="major" id="major-select">
            <option value="">-- Select Your Major --</option>
            ${programs.join('')}
        </select>
        </div>
        <div class="list"></div>
        <button class="button remove" onclick="remove(this)">Remove</button>`
        pageContent.appendChild(newCurriculum)
    }
}

function requestMajorList() {
    // Default headers provided by the browsers should be fine for the time being
    fetch('/major-info', { method: 'POST' })
        .then(res => res.json())
        .then((/** @type {Program[]} data*/ data) => {
            // console.log(data)
            data.forEach(program => {
                // While the JSON response has the SHAPE of Program, we need an actual object representation
                // We can't fill the course list here, we have to wait until its actually submitted
                allPrograms[program.ProgramStack] = new Program({
                    ProgramTitle: program.ProgramTitle,
                    DegreeCode: program.DegreeCode,
                    LocationCode: program.LocationCode,
                    CollegeCode: program.CollegeCode,
                    HasMajorMap: program.HasMajorMap,
                    DisplayDegree: program.DisplayDegree,
                    ProgramStack: program.ProgramStack
                })
                /** @type {HTMLOptionElement} item */
                const item = createElement('option')
                item.id = program.ProgramStack
                item.innerText = program.ProgramTitle
                item.value = program.ProgramTitle
                // The following line is temporary
                $('select').forEach(elem => elem.appendChild(item.cloneNode(true)))
            })
        })
}

/**
 * @param {HTMLButtonElement} element 
 */
function remove(element) {
    element.parentElement.remove()
}

window.onload = () => {
    console.log('Pinning for the fjords')
    // This is for the prototype only, will need refactored/removed later
    requestMajorList()
}