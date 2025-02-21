export type Curriculum = {
    semesters: Vertex[][]
    totalCredits: number
    structuralComplexity?: number
}

export type Vertex = {
    /** 
     * Edges represent a list of courses for which this course acts as a prereq for
     * Co-reqs and be accomplished by having two classes point to each other
     */
    edges: Edge[]
    courseCode: string
    courseName: string
    semester: number
    credits: number
    color?: string
    metrics?: Metrics
    /** A list of one or more numbers that represent the zero-based semester indicies in which a course *must* occur */
    semesterLock?: number[]
}

/** NOTE: This type may be expanded in the future */
export type Edge = string

export type Metrics = {
    delayFactor: number
    blockingFactor: number
    centrality: number
    structuralComplexity: number
}