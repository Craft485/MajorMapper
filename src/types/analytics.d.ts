type Curriculum = {
    semesters: Vertex[][]
    totalCredits: number
}

type Vertex = {
    /** 
     * Edges represent a list of courses for which this course acts as a prereq for
     * Co-reqs and be accomplished by having two classes point to each other
     */
    edges: Edge[]
    courseCode: string
    courseName: string
    semester: number
    credits: number
}

type Edge = {
    courseCode: string
}