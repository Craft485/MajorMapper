export type Curriculum = {
    semesters: Vertex[][]
    totalCredits: number
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
    /** Labled as optional because this is not fully implemented */
    metrics?: Metrics
}

export type Edge = string/*{
    courseCode: string
}*/

/** Metrics based on https://curricularanalytics.org/metrics */
export type Metrics = {
    delayFactor: number
    blockingFactor: number
    centrality: number
    structualComplexity: number
}