export type Curriculum = {
    semesters: Vertex[][]
    totalCredits: number
    structuralComplexity?: number
}

export type Vertex = {
    courseCode: string
    courseName: string
    semester: number
    credits: number
    color?: string
    metrics?: Metrics
    /** A list of one or more numbers that represent the zero-based semester indicies in which a course *must* occur */
    semesterLock?: number[]
    /** Courses that immediatley follow this one */
    postReqs: Edge[]
    /** Courses that are explicitly required to take this one */
    preReqs: Edge[]
    /** Courses that must be taken at the same time as this one */
    coReqs: Edge[]
}

/** NOTE: This type may be expanded in the future */
export type Edge = string

export type Metrics = {
    delayFactor: number
    blockingFactor: number
    centrality: number
    structuralComplexity: number
}