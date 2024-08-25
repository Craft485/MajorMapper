/**
 * This file contains types relevant to data pulled from UC
*/

/** An individual degree program */
export type Program = {
    /** Ex: Computer Science */
    ProgramTitle: string | null
    /** Ex: BSCS */
    DegreeCode: string | null
    /** Ex: West Campus */
    LocationCode: string | null
    /** Ex: Engineering & Applied Science */
    CollegeCode: string | null
    HasMajorMap: boolean
    DisplayDegree: string | null
    /** Ex: 20BC-ASE-BSAERO */
    ProgramStack: string | null
}