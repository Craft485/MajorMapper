// We are unable to do something simple use deconsutrction here because of some oddities with the way that DOM methods work
if (!$) var $ = document.querySelectorAll.bind(document)
if (!id) var id = document.getElementById.bind(document)
if (!createElement) var createElement = document.createElement.bind(document)

const baseURL = 'https://webapps2.uc.edu/ecurriculum/DegreePrograms/Home/MajorMap/'
const MAX_ITEMS = 10

// TODO: Refactor this
function submit() {
    // Clear lists
    Array.from($('.curriculum .list')).forEach(list => { list.innerText = '' })
    /** @type {HTMLSelectElement} majors */
    const majors = Array.from($('select')) || [], programStackList = []
    for (const major of majors) programStackList.push(document.querySelector(`option[value="${major.value}"]`).id)
    fetch(`/submit?q=${programStackList.join(',')}`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            // Handle UI updates (bring out to a global function?)
            console.log(data)
            // Assume that the order that we got the curriculums back is the same order that they are ordered on the page
            const curriculumLists = Array.from($('.curriculum .list'))
            for (let i = 0; i < curriculumLists.length; i++) {
                /** @type {HTMLDivElement} curriculumListElement */
                const curriculumListElement = curriculumLists[i],
                /** @type {Array<string[]>} curriculumData */
                curriculumData = data[i]
                for (const course of curriculumData) {
                    /** @type {HTMLParagraphElement} listItem */
                    const listItem = createElement('p')
                    listItem.className = 'list-item'
                    listItem.innerText = course.join(' ')
                    curriculumListElement.appendChild(listItem)
                }
            }
        })
}

// TODO: Change this function to just simply add a new element instead of weirdly changing the innerHTML every time
function addCurriculum() {
    /** @type {HTMLElement} pageContent */
    const pageContent = id('main')
    if (pageContent.children.length < MAX_ITEMS) {
        // This is temporary
        const programs = Array.from(id('major-select-0').children).filter(e => e.innerText !== '-- Select Your Major --').map(x => `<option id="${x.id}" value="${x.innerText}">${x.innerText}</option>`)
        /** @type HTMLDivElement newCurriculum */
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

// Using this class to keep track of what sort of properties we are interested in, may also be useful if we move to a more OOP approach
class Program {
    constructor (props) {
        /**
         * @type {string | null} ProgramTitle (ex: Computer Science)
         * @default null
         */
        this.ProgramTitle = props.ProgramTitle || null
        /** 
         * @type {string | null} DegreeCode (ex: BSCS)
         * @default null
         */
        this.DegreeCode = props.DegreeCode || null
        /**
         * @type {string | null} LocationCode (ex: West Campus)
         * @default null
         */
        this.LocationCode = props.LocationCode || null
        /** @type {string | null} CollegeCode (ex: Engineering & Applied Science) @default null */
        this.CollegeCode = props.CollegeCode || null
        /** 
         * @type {boolean} HasMajorMap
         * @default false
         */
        this.HasMajorMap = props.HasMajorMap || false
        /** @type {string | null} DisplayDegree */
        this.DisplayDegree = props.DisplayDegree || null
        /**
         * @description  Ex: 20BC-ASE-BSAERO | Used to create the URL for the major map
         * @type {string | null} ProgramStack
         * @default null
         */
        this.ProgramStack = props.ProgramStack || null
    }
}

function requestMajorList() {
    // Default headers provided by the browsers should be fine for the time being
    fetch('/major-info', { method: 'POST' })
        .then(res => res.json())
        .then((/** @type {Program[]} data*/ data) => {
            // console.log(data)
            data.forEach(program => {
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